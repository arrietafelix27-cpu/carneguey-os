import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Skeleton className="mb-4 h-4 w-20" />
      <Skeleton className="mb-5 h-28 w-full rounded-xl" />
      <Skeleton className="mb-3 h-10 w-full rounded-md" />
      <div className="grid grid-cols-2 gap-2">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    </main>
  );
}
