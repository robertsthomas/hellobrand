const WORKSPACE_GENERATION_NOTIFICATION_HINT_KEY =
  "hb-workspace-generation-notification-hint";

export const WORKSPACE_GENERATION_NOTIFICATION_EVENT =
  "hb:workspace-generation-notification";

export function dispatchWorkspaceGenerationNotification(
  detail:
    | {
        action: "upsert";
        notification: unknown;
        showHint?: boolean;
        replaceId?: string;
      }
    | {
        action: "remove";
        notificationId: string;
      }
) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(WORKSPACE_GENERATION_NOTIFICATION_EVENT, { detail })
  );
}
