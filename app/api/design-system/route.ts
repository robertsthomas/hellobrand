/**
 * This route exposes design-system inspection data for internal tooling.
 * It keeps the HTTP boundary here and leaves the actual design-system definitions outside the route.
 */
import { NextResponse } from "next/server";

import { designSystemExport } from "@/lib/design-system/foundation";

export function GET() {
  return NextResponse.json(designSystemExport, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=300",
    },
  });
}
