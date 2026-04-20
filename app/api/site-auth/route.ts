import { type NextRequest, NextResponse } from "next/server";

async function sha256(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(request: NextRequest) {
  const sitePassword = process.env.SITE_PASSWORD?.trim();

  if (!sitePassword) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const body = await request.json();
  const submitted = (body.password as string | undefined)?.trim();

  if (!submitted || submitted !== sitePassword) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const hash = await sha256(sitePassword);

  const response = NextResponse.json({ ok: true });
  response.cookies.set("dev-site-auth", hash, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
