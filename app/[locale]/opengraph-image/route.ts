import { NextResponse } from "next/server";

// Preserve previously shared image URLs without runtime image rendering.
export function GET() {
  return NextResponse.redirect("https://scribix.io/brand/social.png", 308);
}
