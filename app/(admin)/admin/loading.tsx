import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Skeleton className="mb-5 h-4 w-16" />
      <Skeleton className="mb-2 h-7 w-44" />
      <Skeleton className="mb-6 h-4 w-60" />
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    </main>
  );
}
