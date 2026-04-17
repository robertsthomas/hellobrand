import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: ["/", "/(pricing|upload|sample|blog|privacy)/:path*", "/(en|fr|es)/:path*"],
};
