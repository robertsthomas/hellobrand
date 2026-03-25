import { Waitlist } from "@clerk/nextjs";

export default function WaitlistPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fefcfa] px-5 py-16 dark:bg-[#0f1115]">
      <Waitlist />
    </div>
  );
}
