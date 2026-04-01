import { NextRequest } from "next/server";

import {
  formatEmailSubscriptionCategory,
  parseEmailSubscriptionToken,
  setEmailSubscriptionPreference
} from "@/lib/email-subscriptions";

function renderHtml(input: { title: string; body: string; status: number }) {
  return new Response(
    `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${input.title}</title>
        </head>
        <body style="margin:0;background:#f6f3ee;font-family:Arial,sans-serif;color:#1f1a14;">
          <main style="max-width:560px;margin:48px auto;padding:0 20px;">
            <section style="background:#ffffff;border:1px solid #e7dfd3;padding:32px;">
              <h1 style="margin:0 0 12px;font-size:28px;line-height:1.1;">${input.title}</h1>
              <p style="margin:0;font-size:15px;line-height:1.7;color:#4a4034;">${input.body}</p>
            </section>
          </main>
        </body>
      </html>
    `.trim(),
    {
      status: input.status,
      headers: {
        "cache-control": "no-store",
        "content-type": "text/html; charset=utf-8"
      }
    }
  );
}

async function unsubscribeFromRequest(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const payload = parseEmailSubscriptionToken(token);

  if (!payload) {
    return {
      ok: false as const,
      status: 400,
      message:
        "This unsubscribe link is invalid or expired. Sign in to HelloBrand to update your email settings."
    };
  }

  await setEmailSubscriptionPreference({
    email: payload.email,
    category: payload.category,
    isSubscribed: false,
    source: "email_one_click"
  });

  return {
    ok: true as const,
    status: 200,
    message: `You are unsubscribed from HelloBrand ${formatEmailSubscriptionCategory(
      payload.category
    )}.`
  };
}

export async function GET(request: NextRequest) {
  const result = await unsubscribeFromRequest(request);

  return renderHtml({
    title: result.ok ? "Unsubscribed" : "Unsubscribe failed",
    body: result.message,
    status: result.status
  });
}

export async function POST(request: NextRequest) {
  const result = await unsubscribeFromRequest(request);

  return Response.json(
    {
      ok: result.ok,
      message: result.message
    },
    {
      status: result.status,
      headers: {
        "cache-control": "no-store"
      }
    }
  );
}
