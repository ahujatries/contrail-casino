import { NextResponse, type NextRequest } from 'next/server';

const COOKIE = 'ap_uid';
const YEAR_SECONDS = 365 * 24 * 60 * 60;

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.cookies.has(COOKIE)) {
    const uid = crypto.randomUUID();
    res.cookies.set(COOKIE, uid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: YEAR_SECONDS,
      path: '/',
    });
  }
  return res;
}

// Don't run middleware on assets or the SSE endpoint (cookies aren't needed there
// and we want zero overhead on the hot path).
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/events|api/live).*)',
  ],
};
