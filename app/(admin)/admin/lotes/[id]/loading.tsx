import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <Skeleton className="mb-5 h-4 w-16" />
      <Skeleton className="mb-2 h-3 w-32" />
      <Skeleton className="mb-1 h-8 w-44" />
      <Skeleton className="mb-6 h-4 w-40" />
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="mb-6 h-24 w-full rounded-3xl" />
      <Skeleton className="mb-2 h-3 w-44" />
      <Skeleton className="h-48 w-full rounded-3xl" />
    </main>
  );
}
