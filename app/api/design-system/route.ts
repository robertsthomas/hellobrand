import { NextResponse } from "next/server";

import { designSystemExport } from "@/lib/design-system/foundation";

export function GET() {
  return NextResponse.json(designSystemExport, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=300",
    },
  });
}
