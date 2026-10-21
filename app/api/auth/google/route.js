import { NextResponse } from "next/server";
import { isGoogleOAuthConfigured, getGoogleAuthUrl } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const origin = new URL(request.url).origin;
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        message: "Google OAuth requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env",
      },
      { status: 400 }
    );
  }

  const url = getGoogleAuthUrl(origin);
  return NextResponse.redirect(url);
}

