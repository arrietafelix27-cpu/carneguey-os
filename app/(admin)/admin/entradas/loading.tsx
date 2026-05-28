import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <Skeleton className="mb-5 h-4 w-16" />
      <Skeleton className="mb-7 h-8 w-52" />
      <div className="space-y-2 rounded-3xl bg-card p-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-3 py-3">
            <Skeleton className="size-11 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
