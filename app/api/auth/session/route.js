import { NextResponse } from "next/server";
import {
  COOKIE_NAME,
  isGoogleOAuthConfigured,
  createSessionToken,
  getSessionFromRequest,
} from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const session = getSessionFromRequest(request);
    return NextResponse.json({
      user: session,
      isConfigured: isGoogleOAuthConfigured(),
    });
  } catch (e) {
    return NextResponse.json({ user: null, error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const prisma = await getPrisma();
    const body = await request.json();
    const email = body.email?.trim()?.toLowerCase();
    const name = body.name?.trim() || email?.split("@")[0] || "User";

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }

    // Upsert user in database
    const user = await prisma.user.upsert({
      where: { email },
      update: { name, image: body.image || null },
      create: { email, name, image: body.image || null },
    });

    const token = createSessionToken(user);

    const response = NextResponse.json({ user, ok: true });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    return response;
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true, user: null });
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}

