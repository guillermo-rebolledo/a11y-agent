import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  FIXTURE_INSTALLATION_COOKIE,
  FIXTURE_SESSION_COOKIE,
  fixtureAuthEnabled,
} from "@/lib/fixture-auth";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (
    !fixtureAuthEnabled() ||
    cookieStore.get(FIXTURE_SESSION_COOKIE)?.value !== "fixture-session"
  ) {
    return NextResponse.json(
      { error: "GitHub authentication required" },
      { status: 401 },
    );
  }

  const response = NextResponse.redirect(
    new URL("/onboarding", request.url),
    303,
  );
  response.cookies.set(FIXTURE_INSTALLATION_COOKIE, "24680", {
    httpOnly: true,
    sameSite: "strict",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
  });
  return response;
}
