import { redirect } from "next/navigation";

export default async function BillingRedirect({
  searchParams
}: {
  searchParams?: Promise<Record<string, string>>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const qs = new URLSearchParams(resolved).toString();
  redirect(qs ? `/app/settings/billing?${qs}` : "/app/settings/billing");
}
