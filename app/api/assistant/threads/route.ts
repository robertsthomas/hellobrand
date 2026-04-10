/**
 * This route handles assistant HTTP requests.
 * It turns the request into assistant runtime calls while the assistant logic itself stays in `lib/assistant`.
 */
import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { defaultAssistantThreadTitle } from "@/lib/assistant/snapshots";
import { getRepository } from "@/lib/repository";
import { assistantThreadCreateSchema, assistantScopeValues } from "@/lib/validation";
import { fail, ok } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    const viewer = await requireApiViewer();
    const scope = request.nextUrl.searchParams.get("scope");
    const dealId = request.nextUrl.searchParams.get("dealId");
    const threads = await getRepository().listAssistantThreads(viewer.id, {
      scope:
        scope && assistantScopeValues.includes(scope as (typeof assistantScopeValues)[number])
          ? (scope as "user" | "deal")
          : undefined,
      dealId: dealId ?? undefined
    });

    return ok({ threads });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unauthorized", 401);
  }
}

export async function POST(request: NextRequest) {
  try {
    const viewer = await requireApiViewer();
    const body = await request.json();
    const input = assistantThreadCreateSchema.parse(body);
    const title =
      input.title?.trim() ||
      defaultAssistantThreadTitle(input.scope, {
        dealName: input.context.trigger?.label ?? null
      });
    const thread = await getRepository().createAssistantThread(viewer.id, {
      scope: input.scope,
      dealId: input.dealId ?? null,
      title,
      summary: null
    });

    return ok({ thread }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create assistant thread.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
