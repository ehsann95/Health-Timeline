const crypto = require("crypto");

const COOKIE_NAME = "health_timeline_session";
const AUTH_SECRET = process.env.AUTH_SECRET || "health-timeline-default-secret-key-2026";

function isGoogleOAuthConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_CLIENT_ID.trim().length > 5
  );
}

// Sign a session payload into a tamper-proof token
function createSessionToken(user) {
  const payload = {
    id: user.id || `usr_${crypto.randomBytes(6).toString("hex")}`,
    email: user.email,
    name: user.name || user.email.split("@")[0],
    image: user.image || null,
    createdAt: Date.now(),
  };
  const str = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", AUTH_SECRET).update(str).digest("base64url");
  return `${str}.${signature}`;
}

// Verify and decode a session token
function verifySessionToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [str, signature] = token.split(".");
  const expectedSig = crypto.createHmac("sha256", AUTH_SECRET).update(str).digest("base64url");
  if (signature !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(str, "base64url").toString("utf8"));
    return payload;
  } catch {
    return null;
  }
}

// Extract session from incoming request
function getSessionFromRequest(request) {
  try {
    let token = null;
    if (request.cookies?.get) {
      token = request.cookies.get(COOKIE_NAME)?.value;
    } else if (typeof request.headers?.get === "function") {
      const cookieHeader = request.headers.get("cookie") || "";
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
      if (match) token = match[1];
    }
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

// Helper to construct Google OAuth authorization URL
function getGoogleAuthUrl(origin) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${origin}/api/auth/callback/google`;
  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });
  return `${rootUrl}?${params.toString()}`;
}

// Helper to exchange Google OAuth code for tokens and userinfo
async function exchangeGoogleCode(code, origin) {
  const redirectUri = `${origin}/api/auth/callback/google`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description || "Google token exchange failed");
  }

  const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const userData = await userRes.json();
  if (!userRes.ok) throw new Error("Failed to fetch Google user profile");

  return {
    id: userData.sub,
    email: userData.email,
    name: userData.name || userData.email.split("@")[0],
    image: userData.picture || null,
  };
}

module.exports = {
  COOKIE_NAME,
  isGoogleOAuthConfigured,
  createSessionToken,
  verifySessionToken,
  getSessionFromRequest,
  getGoogleAuthUrl,
  exchangeGoogleCode,
};

