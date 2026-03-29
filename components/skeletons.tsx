function Pulse({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.06] ${className ?? ""}`}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="px-5 py-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1380px] space-y-6">
        <div className="border border-black/8 bg-white px-7 py-7 dark:border-white/10 dark:bg-[#15191f]">
          <Pulse className="h-4 w-40" />
          <Pulse className="mt-2 h-9 w-72" />
          <Pulse className="mt-4 h-5 w-[480px] max-w-full" />
        </div>
        <div className="border border-black/8 bg-white px-6 py-6 dark:border-white/10 dark:bg-[#15191f]">
          <Pulse className="h-4 w-28" />
          <Pulse className="mt-2 h-8 w-56" />
          <Pulse className="mt-2 h-5 w-96 max-w-full" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="border border-black/7 bg-[#fbfbfc] px-5 py-5 dark:border-white/10 dark:bg-[#10141a]"
              >
                <Pulse className="h-5 w-64" />
                <Pulse className="mt-2 h-4 w-32" />
                <Pulse className="mt-4 h-10 w-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-6 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="border border-black/8 bg-white px-5 py-4 dark:border-white/10 dark:bg-[#15191f]"
            >
              <Pulse className="h-4 w-24" />
              <Pulse className="mt-2 h-4 w-40" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DealDetailSkeleton() {
  return (
    <div className="px-6 py-8 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-[1280px] space-y-8">
        <Pulse className="h-5 w-20" />
        <div className="space-y-3 border-b border-black/8 pb-8 dark:border-white/10">
          <Pulse className="h-10 w-80" />
          <Pulse className="h-4 w-64" />
        </div>
        <div className="grid gap-4 md:gap-8 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="border-b border-black/8 pb-3 dark:border-white/10"
            >
              <Pulse className="h-3 w-16" />
              <Pulse className="mt-2 h-7 w-28" />
              <Pulse className="mt-2 h-4 w-40" />
            </div>
          ))}
        </div>
        <Pulse className="h-10 w-full max-w-2xl" />
        <Pulse className="h-96 w-full" />
      </div>
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div className="px-5 py-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1380px] space-y-8">
        <div className="border-b border-black/8 pb-8">
          <Pulse className="h-4 w-16" />
          <Pulse className="mt-3 h-10 w-48" />
          <Pulse className="mt-4 h-5 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[#f7f5f1] px-4 py-4">
              <Pulse className="h-3 w-24" />
              <Pulse className="mt-2 h-7 w-20" />
              <Pulse className="mt-3 h-2 w-full" />
            </div>
          ))}
        </div>
        <Pulse className="h-[280px] w-full" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: rows }).map((_, i) => (
        <Pulse key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#15191f]">
      <Pulse className="h-4 w-24" />
      <Pulse className="mt-2 h-7 w-48" />
      <div className="mt-6 space-y-4 border-t border-black/8 pt-4 dark:border-white/10">
        {Array.from({ length: 3 }).map((_, i) => (
          <Pulse key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}

export function PaymentsSkeleton() {
  return (
    <div className="px-5 py-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1380px] space-y-8">
        <div className="space-y-6 border-b border-black/8 pb-8">
          <div>
            <Pulse className="h-4 w-16" />
            <Pulse className="mt-3 h-12 w-48" />
            <Pulse className="mt-4 h-5 w-96" />
          </div>
          <div className="grid gap-6 border-t border-black/8 pt-5 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <Pulse className="h-3 w-16" />
                <Pulse className="mt-2 h-9 w-28" />
              </div>
            ))}
          </div>
        </div>
        {Array.from({ length: 2 }).map((_, i) => (
          <Pulse key={i} className="h-64 w-full" />
        ))}
      </div>
    </div>
  );
}

export function NotificationsSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <Pulse className="h-8 w-48" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Pulse key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="px-8 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <Pulse className="h-10 w-48" />
        <Pulse className="h-5 w-96" />
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Pulse className="h-4 w-24" />
              <Pulse className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
