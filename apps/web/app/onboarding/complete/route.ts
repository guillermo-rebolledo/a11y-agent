import { NextResponse } from "next/server";

export async function POST(request: Request) {
  await request.formData();
  return NextResponse.redirect(new URL("/projects/example", request.url), 303);
}
