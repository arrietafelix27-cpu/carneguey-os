import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { listTeam } from "@/lib/actions/team";
import { TeamManager } from "@/components/admin/team-manager";

export const metadata = { title: "Equipo" };
export const dynamic = "force-dynamic";

export default async function EquipoPage() {
  const team = await listTeam();

  return (
    <main className="mx-auto max-w-2xl px-4 py-9">
      <Link
        href="/admin"
        className="mb-5 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Panel
      </Link>

      <p className="text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        Configuración
      </p>
      <h1 className="mb-6 mt-1 text-[28px] font-bold leading-tight tracking-tight text-foreground">
        Equipo
      </h1>

      <TeamManager team={team} />
    </main>
  );
}
