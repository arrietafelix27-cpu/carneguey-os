import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Skeleton className="mb-5 h-7 w-44" />
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    </main>
  );
}
