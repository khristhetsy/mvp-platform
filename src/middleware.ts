import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: [
    // Match all paths except: api, _next/static, _next/image, static files
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon|sitemap|robots).*)",
  ],
};
