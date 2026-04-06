import { PostHogSubmitButton } from "@/components/posthog-submit-button";

export function IntakeReviewFooter({
  attentionCount,
  disabled,
}: {
  attentionCount: number;
  disabled: boolean;
}) {
  return (
    <div className="sticky bottom-4 z-20">
      <div className="flex w-full items-center justify-between gap-3 border border-black/8 bg-white/92 px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-[#11161c]/92">
        <span className="text-sm text-black/55 dark:text-white/55">
          {attentionCount > 0
            ? `${attentionCount} item${attentionCount === 1 ? "" : "s"} to review`
            : "Ready to confirm"}
        </span>
        <PostHogSubmitButton
          eventName="intake_confirmation_submitted"
          payload={{ source: "intake_review" }}
          pendingLabel="Generating workspace..."
          className="bg-ocean px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
        >
          Create workspace
        </PostHogSubmitButton>
      </div>
    </div>
  );
}
