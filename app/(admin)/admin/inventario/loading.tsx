import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <Skeleton className="mb-5 h-4 w-16" />
      <Skeleton className="mb-7 h-8 w-44" />
      <Skeleton className="mb-8 h-24 w-full rounded-3xl" />
      <Skeleton className="mb-3 h-11 w-full rounded-md" />
      <div className="mb-7 flex flex-wrap gap-2">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-16 rounded-full" />
        ))}
      </div>
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    </main>
  );
}
