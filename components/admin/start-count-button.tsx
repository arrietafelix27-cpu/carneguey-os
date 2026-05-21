"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { startSalesCount } from "@/lib/actions/conteo";
import { Button } from "@/components/ui/button";

export function StartCountButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      className="gap-2"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await startSalesCount();
          if ("error" in result) {
            toast.error(result.error);
            return;
          }
          router.push(`/admin/conteo/${result.countId}`);
        })
      }
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Plus className="size-4" />
      )}
      Iniciar conteo
    </Button>
  );
}
