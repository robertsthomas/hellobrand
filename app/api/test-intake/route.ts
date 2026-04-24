/**
 * This route handles intake test helpers.
 * It keeps test-only intake cleanup separate from the production intake flow.
 */
import { fail, ok } from "@/lib/http";
import { isE2EAuthEnabled } from "@/lib/e2e-auth";
import { deleteIntakeDraftForViewer, listIntakeDraftsForViewer } from "@/lib/intake";

type Payload = {
  secret?: string;
  userId?: string;
  action?: "reset";
};

export async function POST(request: Request) {
  if (!isE2EAuthEnabled()) {
    return fail("Not found.", 404);
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return fail("Invalid request body.", 400);
  }

  if (payload.secret !== process.env.HELLOBRAND_E2E_AUTH_SECRET) {
    return fail("Invalid test auth secret.", 401);
  }

  if ((payload.action ?? "reset") !== "reset") {
    return fail("Invalid action.", 400);
  }

  const userId = payload.userId?.trim() || "demo-user";
  const viewer = {
    id: userId,
    email: `${userId}@hellobrand.app`,
    displayName: "Demo Creator",
    mode: "demo" as const,
  };

  if (!process.env.DATABASE_URL) {
    return ok({ message: "No database configured.", userId });
  }

  const drafts = await listIntakeDraftsForViewer(viewer);
  for (const draft of drafts) {
    try {
      await deleteIntakeDraftForViewer(viewer, draft.session.id);
    } catch {
      // Cleanup is best-effort in tests. The draft may already be gone if
      // related records were removed earlier in the same reset pass.
    }
  }

  return ok({ message: "Intake drafts reset.", userId, deletedCount: drafts.length });
}
