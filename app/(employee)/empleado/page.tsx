import Link from "next/link";
import { ScanLine, ChevronRight } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";

export const metadata = { title: "Inicio · Carnegüey" };

export default async function EmployeeHome() {
  const profile = await getCurrentProfile();
  const firstName = profile.full_name.split(" ")[0];

  return (
    <main className="mx-auto max-w-2xl px-4 py-9">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        Punto de operación
      </p>
      <h1 className="mb-8 mt-1 text-[34px] font-bold leading-tight tracking-tight text-foreground">
        Hola, {firstName}
      </h1>

      <Link
        href="/empleado/pos"
        className="flex items-center gap-4 rounded-3xl bg-primary px-6 py-6 text-primary-foreground shadow-[var(--shadow-brand)] transition-transform active:scale-[0.98]"
      >
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/15">
          <ScanLine className="size-7" strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[20px] font-bold tracking-tight">
            Abrir POS
          </span>
          <span className="block text-[14px] text-primary-foreground/80">
            Escanear y cobrar
          </span>
        </span>
        <ChevronRight className="size-6 shrink-0 text-primary-foreground/70" />
      </Link>
    </main>
  );
}
