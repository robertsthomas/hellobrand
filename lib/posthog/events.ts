import type { PostHog } from "posthog-js";

import { isPostHogClientEnabled } from "@/lib/posthog/config";

const appActionEventNames = [
  "auth_mode_switched",
  "auth_sign_in_submitted",
  "auth_sign_up_submitted",
  "auth_verification_submitted",
  "auth_verification_resent",
  "public_pricing_cta_clicked",
  "public_upload_gate_signup_clicked",
  "public_upload_gate_signin_clicked",
  "onboarding_skip_cta_clicked",
  "workspace_entry_cta_clicked",
  "workspace_source_mode_selected",
  "workspace_file_picker_clicked",
  "workspace_saved",
  "workspace_analysis_started",
  "workspace_analysis_failed",
  "workspace_add_another_clicked",
  "workspace_documents_submitted",
  "workspace_pasted_context_submitted",
  "inbox_connect_email_clicked",
  "billing_portal_clicked",
  "billing_checkout_started",
  "billing_cancel_clicked",
  "email_connection_started",
  "email_disconnect_clicked",
  "intake_confirmation_submitted",
  "feedback_widget_opened",
  "feedback_widget_dismissed",
  "feedback_followup_requested"
] as const;

export type AppActionEventName = (typeof appActionEventNames)[number];

type PostHogCaptureClient = Pick<PostHog, "capture"> | null | undefined;

export function captureAppEvent(
  posthog: PostHogCaptureClient,
  eventName: AppActionEventName,
  properties?: Record<string, unknown>
) {
  if (!isPostHogClientEnabled()) {
    return;
  }

  posthog?.capture(eventName, properties);
}
