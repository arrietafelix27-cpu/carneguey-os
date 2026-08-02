"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-secondary px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-5 grid size-16 place-items-center rounded-[var(--radius-xl)] bg-[var(--brand-red-soft)] text-primary">
          <TriangleAlert className="size-8" />
        </div>
        <h1 className="text-[22px] font-bold tracking-tight text-foreground">
          Algo salió mal
        </h1>
        <p className="mt-2 text-[15px] text-secondary-foreground">
          Ocurrió un error inesperado. Puedes intentar de nuevo o volver al
          inicio.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button size="lg" className="w-full" onClick={() => reset()}>
            Intentar de nuevo
          </Button>
          <Link
            href="/"
            className={buttonVariants({
              variant: "secondary",
              size: "lg",
              className: "w-full",
            })}
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
