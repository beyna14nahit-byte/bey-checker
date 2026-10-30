import { NextResponse, type NextRequest } from "next/server";

// First line of defence only: every admin page and route also checks the session in the database.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin/login" || pathname === "/admin/setup") return NextResponse.next();
  if (!req.cookies.get("bey_admin")) {
    // File links are opened from WhatsApp messages: sign in first, then continue to the file.
    if (pathname.startsWith("/api/admin") && !pathname.startsWith("/api/admin/files/")) return NextResponse.json({ ok: false }, { status: 401 });
    return NextResponse.redirect(loginUrl(req));
  }
  return NextResponse.next();
}

function loginUrl(req: NextRequest) {
  const url = new URL("/admin/login", req.url);
  const next = req.nextUrl.pathname + req.nextUrl.search;
  if (next !== "/admin") url.searchParams.set("next", next);
  return url;
}

export const config = { matcher: ["/admin/:path*", "/api/admin/files/:path*", "/api/admin/payment-qr"] };
