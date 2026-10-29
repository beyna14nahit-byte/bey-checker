import { NextResponse, type NextRequest } from "next/server";

// First line of defence only: every admin page and route also checks the session in the database.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin/login" || pathname === "/admin/setup") return NextResponse.next();
  if (!req.cookies.get("byc_admin")) {
    if (pathname.startsWith("/api/admin")) return NextResponse.json({ ok: false }, { status: 401 });
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/api/admin/files/:path*", "/api/admin/payment-qr"] };
