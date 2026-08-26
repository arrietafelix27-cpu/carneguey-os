import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getPermissions } from "@/lib/permissions.server";
import { DelicateActionsEditor } from "@/components/admin/delicate-actions-editor";

export const metadata = { title: "Acciones delicadas" };
export const dynamic = "force-dynamic";

export default async function AccionesDelicadasPage() {
  const permissions = await getPermissions();

  return (
    <main className="mx-auto max-w-2xl px-4 py-9">
      <Link
        href="/admin"
        className="mb-5 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Panel
      </Link>

      <h1 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">
        Acciones delicadas
      </h1>
      <p className="mb-7 mt-1 text-[15px] leading-snug text-secondary-foreground">
        Decide qué puede hacer tu equipo por su cuenta y qué prefieres aprobar
        tú. Todo lo que hagan queda registrado, apruebes o no.
      </p>

      <DelicateActionsEditor permissions={permissions} />
    </main>
  );
}
