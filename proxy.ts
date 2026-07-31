import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// Everything is private. Only the login screen itself is reachable signed out —
// server actions POST back to the page they came from, so gating the page
// routes here also gates every mutation.

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value
  );

  if (pathname === "/login") {
    if (signedIn) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (!signedIn) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Skip Next internals and the PWA assets, then guard everything else.
  // The manifest and icons must stay reachable signed out: the OS fetches them
  // when you Add to Home Screen, and a redirect there means no icon.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon).*)",
  ],
};
