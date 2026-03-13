import { saveProfileAction } from "@/app/actions";
import { requireViewer } from "@/lib/auth";
import { getProfileForViewer } from "@/lib/profile";

export default async function ProfilePage() {
  const viewer = await requireViewer();
  const profile = await getProfileForViewer(viewer);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="max-w-3xl">
          <h1 className="text-4xl font-semibold text-ink">Profile</h1>
          <p className="mt-4 text-black/60 dark:text-white/65">
            Manage the creator identity and default contact details used in
            intake confirmation, deal workspaces, and draft emails.
          </p>
        </section>

        <form
          action={saveProfileAction}
          className="grid gap-6 rounded-[2rem] border border-black/5 bg-white/85 p-8 shadow-panel dark:border-white/10 dark:bg-white/[0.06]"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
              Display name
              <input
                className="rounded-[1.25rem] border border-black/10 bg-sand/50 px-4 py-4 dark:border-white/12 dark:bg-white/[0.05]"
                name="displayName"
                defaultValue={profile.displayName ?? viewer.displayName}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
              Contact email
              <input
                className="rounded-[1.25rem] border border-black/10 bg-sand/50 px-4 py-4 dark:border-white/12 dark:bg-white/[0.05]"
                name="contactEmail"
                type="email"
                defaultValue={profile.contactEmail ?? viewer.email}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
              Creator / legal name
              <input
                className="rounded-[1.25rem] border border-black/10 bg-sand/50 px-4 py-4 dark:border-white/12 dark:bg-white/[0.05]"
                name="creatorLegalName"
                defaultValue={profile.creatorLegalName ?? ""}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
              Business name
              <input
                className="rounded-[1.25rem] border border-black/10 bg-sand/50 px-4 py-4 dark:border-white/12 dark:bg-white/[0.05]"
                name="businessName"
                defaultValue={profile.businessName ?? ""}
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
            Preferred email signature
            <input
              className="rounded-[1.25rem] border border-black/10 bg-sand/50 px-4 py-4 dark:border-white/12 dark:bg-white/[0.05]"
              name="preferredSignature"
              defaultValue={profile.preferredSignature ?? ""}
              placeholder="Best, Sarah"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
            Payout details
            <textarea
              className="min-h-32 rounded-[1.5rem] border border-black/10 bg-sand/50 px-4 py-4 dark:border-white/12 dark:bg-white/[0.05]"
              name="payoutDetails"
              defaultValue={profile.payoutDetails ?? ""}
              placeholder="Invoice instructions, preferred payment method, or finance contact details."
            />
          </label>

          <div className="flex justify-end">
            <button className="rounded-full bg-ocean px-6 py-3 text-sm font-semibold text-white">
              Save profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
