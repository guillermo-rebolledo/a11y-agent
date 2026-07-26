import { NextResponse } from "next/server";

import { FIXTURE_SESSION_COOKIE, fixtureAuthEnabled } from "@/lib/fixture-auth";

export function GET(request: Request) {
  const url = new URL(request.url);
  if (!fixtureAuthEnabled()) {
    return NextResponse.json(
      { error: "GitHub fixture authentication is disabled by default" },
      { status: 503 },
    );
  }

  const response = NextResponse.redirect(new URL("/auth/github/install", url));
  response.cookies.set(FIXTURE_SESSION_COOKIE, "fixture-session", {
    httpOnly: true,
    sameSite: "strict",
    secure: url.protocol === "https:",
    path: "/",
  });
  return response;
}
