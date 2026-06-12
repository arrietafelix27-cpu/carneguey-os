"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { startQuincenalCount } from "@/lib/actions/conteo";
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
          const result = await startQuincenalCount();
          if ("error" in result) {
            toast.error(result.error);
            return;
          }
          router.push("/admin/conteo/nuevo");
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
