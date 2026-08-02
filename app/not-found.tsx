import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-secondary px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-5 grid size-16 place-items-center rounded-[var(--radius-xl)] bg-[var(--brand-red-soft)] text-primary">
          <Compass className="size-8" />
        </div>
        <h1 className="text-[22px] font-bold tracking-tight text-foreground">
          Página no encontrada
        </h1>
        <p className="mt-2 text-[15px] text-secondary-foreground">
          La página que buscas no existe o fue movida.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className={buttonVariants({ size: "lg", className: "w-full" })}
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
