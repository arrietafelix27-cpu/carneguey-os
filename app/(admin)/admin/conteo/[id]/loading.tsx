import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Skeleton className="mb-4 h-4 w-16" />
      <Skeleton className="mb-1 h-8 w-44" />
      <Skeleton className="mb-5 h-4 w-72" />
      <Skeleton className="mb-4 h-11 w-full rounded-md" />
      <div className="space-y-3 rounded-3xl bg-card shadow-sm p-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    </main>
  );
}
