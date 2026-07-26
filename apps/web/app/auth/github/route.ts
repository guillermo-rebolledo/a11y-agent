import { NextResponse } from "next/server";

export function GET(request: Request) {
  const url = new URL(request.url);
  if (process.env.APP_ENV === "production") {
    return NextResponse.json(
      { error: "GitHub authentication is disabled pending qualification" },
      { status: 503 },
    );
  }

  return NextResponse.redirect(
    new URL("/onboarding?provider=github-fixture", url),
  );
}
