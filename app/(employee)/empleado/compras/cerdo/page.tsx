import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Provider } from "@/lib/catalog";
import { CarcassLotForm } from "@/components/employee/carcass-lot-form";

export const metadata = { title: "Cerdo · Carnegüey" };

export default async function CerdoPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("providers")
    .select("id, name, phone, active")
    .eq("active", true)
    .order("name");

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href="/empleado/compras"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" />
        Compras
      </Link>
      <h1 className="mb-5 text-2xl font-bold tracking-tight text-foreground">
        Cerdo en canal
      </h1>
      <CarcassLotForm type="pork_carcass" providers={(data ?? []) as Provider[]} />
    </main>
  );
}
