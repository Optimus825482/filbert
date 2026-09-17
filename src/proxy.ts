import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const w = request.nextUrl.searchParams.get("w");
  const isPublicPage = ["/setup", "/giris", "/yetkisiz"].includes(request.nextUrl.pathname);
  if (!isPublicPage && !request.cookies.has("filbert_session")) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/giris";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-filbert-public-page", String(isPublicPage));
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (w === "1") response.headers.set("x-is-window", "1");
  return response;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|icon.svg|logo.svg|logo.png|filbert.png|filbertt.png|all-icons|manifest.webmanifest|sw.js|api).*)"],
};
