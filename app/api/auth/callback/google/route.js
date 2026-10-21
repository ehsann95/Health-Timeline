import { NextResponse } from "next/server";
import {
  COOKIE_NAME,
  createSessionToken,
  exchangeGoogleCode,
} from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const origin = url.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/?auth_error=No+code+provided`);
  }

  try {
    const prisma = await getPrisma();
    const googleProfile = await exchangeGoogleCode(code, origin);

    const user = await prisma.user.upsert({
      where: { email: googleProfile.email },
      update: { name: googleProfile.name, image: googleProfile.image },
      create: {
        id: googleProfile.id,
        email: googleProfile.email,
        name: googleProfile.name,
        image: googleProfile.image,
      },
    });

    const token = createSessionToken(user);
    const response = NextResponse.redirect(`${origin}/?login_success=true`);

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(err.message)}`);
  }
}

