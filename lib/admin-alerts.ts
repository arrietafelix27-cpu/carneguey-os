import type { SupabaseClient } from "@supabase/supabase-js";
import { getMermaThresholds } from "@/lib/analytics";

export type AlertIcon =
  | "clock"
  | "trending-down"
  | "calendar"
  | "package"
  | "bird"
  | "transfer"
  | "split";

export type AlertSeverity = "warning" | "danger";

export type Alert = {
  id: string;
  severity: AlertSeverity;
  icon: AlertIcon;
  title: string;
  description?: string;
  href: string;
};

const DAY = 86_400_000;

/**
 * Calcula las alertas activas del admin. Si no hay nada urgente devuelve
 * una lista vacía y el panel del dashboard no se muestra.
 */
export async function getAdminAlerts(
  supabase: SupabaseClient,
): Promise<Alert[]> {
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY).toISOString();

  const [
    activeLotsResult,
    allLotsResult,
    despostesResult,
    thresholds,
    lastCountResult,
    recentPoultryResult,
    recentMovsResult,
    pendingTransfersResult,
    pendingSubDespostesResult,
  ] = await Promise.all([
    supabase
      .from("v_lot_summary")
      .select("lot_id, lot_code, arrival_date, status")
      .eq("status", "active"),
    supabase
      .from("v_lot_summary")
      .select("lot_id, lot_code, type")
      .in("status", ["active", "closed"]),
    supabase
      .from("v_desposte_summary")
      .select("desposte_id, lot_id, finalized_at, merma_pct")
      .eq("status", "finalized")
      .order("finalized_at", { ascending: false })
      .limit(50),
    getMermaThresholds(supabase),
    supabase
      .from("physical_counts")
      .select("id, completed_at")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1),
    supabase
      .from("direct_purchases")
      .select("id, purchase_date, products(category)")
      .order("purchase_date", { ascending: false })
      .limit(40),
    supabase
      .from("inventory_movements")
      .select("product_id")
      .gte("created_at", since30),
    supabase
      .from("cut_transfers")
      .select("id")
      .eq("status", "pending"),
    supabase
      .from("sub_despostes")
      .select("id")
      .eq("status", "pending"),
  ]);

  const activeLots = activeLotsResult.data ?? [];
  const allLots = allLotsResult.data ?? [];
  const recentDespostes = despostesResult.data ?? [];
  const lastCount = lastCountResult.data?.[0];
  const recentDPs = recentPoultryResult.data ?? [];
  const recentMovs = recentMovsResult.data ?? [];
  const pendingTransfers = pendingTransfersResult.data ?? [];
  const pendingSubDespostes = pendingSubDespostesResult.data ?? [];

  const alerts: Alert[] = [];
  const lotById = new Map(allLots.map((l) => [l.lot_id as string, l]));

  // 0) Transferencias de cortes pendientes de aprobación
  if (pendingTransfers.length > 0) {
    const n = pendingTransfers.length;
    alerts.push({
      id: "transferencias-pendientes",
      severity: "warning",
      icon: "transfer",
      title: `${n} ${n === 1 ? "transferencia pendiente" : "transferencias pendientes"}`,
      description: "Revísalas para aplicar al inventario",
      href: "/admin/transferencias",
    });
  }

  // 0b) Sub-despostes pendientes de aprobación
  if (pendingSubDespostes.length > 0) {
    const n = pendingSubDespostes.length;
    alerts.push({
      id: "sub-despostes-pendientes",
      severity: "warning",
      icon: "split",
      title: `${n} ${n === 1 ? "sub-desposte pendiente" : "sub-despostes pendientes"}`,
      description: "Revísalos para aplicar al inventario",
      href: "/admin/sub-despostes",
    });
  }

  // 1) Lotes activos sin desposte hace más de 10 días
  const lastFinalizedByLot = new Map<string, string>();
  for (const d of recentDespostes) {
    const lid = d.lot_id as string;
    const fa = d.finalized_at as string | null;
    if (!fa) continue;
    const cur = lastFinalizedByLot.get(lid);
    if (!cur || fa > cur) lastFinalizedByLot.set(lid, fa);
  }
  for (const lot of activeLots) {
    const lid = lot.lot_id as string;
    const lastActivity =
      lastFinalizedByLot.get(lid) ?? (lot.arrival_date as string | null);
    if (!lastActivity) continue;
    const daysSince = (now - new Date(lastActivity).getTime()) / DAY;
    if (daysSince > 10) {
      alerts.push({
        id: `stale-lot-${lid}`,
        severity: "warning",
        icon: "clock",
        title: `Lote ${lot.lot_code} sin desposte`,
        description: `${Math.floor(daysSince)} días sin actividad`,
        href: `/admin/lotes/${lid}`,
      });
    }
  }

  // 2) Merma del último desposte por encima del umbral
  const last = recentDespostes[0];
  if (last) {
    const lot = lotById.get(last.lot_id as string);
    const type = (lot?.type as string | undefined) ?? "beef_carcass";
    const threshold =
      type === "pork_carcass" ? thresholds.pork : thresholds.beef;
    const mermaPct = Number(last.merma_pct ?? 0);
    if (mermaPct > threshold) {
      alerts.push({
        id: `high-merma-${last.desposte_id}`,
        severity: "danger",
        icon: "trending-down",
        title: `Merma alta en ${lot?.lot_code ?? "el último desposte"}`,
        description: `${mermaPct.toFixed(1)}% (umbral ${threshold}%)`,
        href: `/admin/lotes/${last.lot_id}`,
      });
    }
  }

  // 3) Conteo quincenal próximo (3 días antes del día 15)
  if (lastCount?.completed_at) {
    const daysSince =
      (now - new Date(lastCount.completed_at as string).getTime()) / DAY;
    if (daysSince > 12) {
      alerts.push({
        id: "conteo-pendiente",
        severity: "warning",
        icon: "calendar",
        title: "Conteo quincenal pendiente",
        description: `${Math.floor(daysSince)} días desde el último`,
        href: "/admin/conteo",
      });
    }
  } else {
    alerts.push({
      id: "conteo-nunca",
      severity: "warning",
      icon: "calendar",
      title: "Sin conteo registrado",
      description: "Inicia el primer conteo quincenal",
      href: "/admin/conteo",
    });
  }

  // 4) Productos con stock 0 y movimiento en los últimos 30 días
  const recentProductIds = new Set(
    recentMovs.map((m) => m.product_id as string),
  );
  if (recentProductIds.size > 0) {
    const { data: inv } = await supabase
      .from("v_current_inventory")
      .select("product_id, product_name, quantity_in_stock")
      .in("product_id", Array.from(recentProductIds));
    const zero = (inv ?? []).filter(
      (p) => Number(p.quantity_in_stock ?? 0) <= 0,
    );
    if (zero.length > 0) {
      const sample = zero.slice(0, 3).map((p) => p.product_name as string);
      alerts.push({
        id: "stock-cero",
        severity: "warning",
        icon: "package",
        title: `${zero.length} ${zero.length === 1 ? "producto en cero" : "productos en cero"}`,
        description:
          zero.length <= 3
            ? sample.join(", ")
            : `${sample.join(", ")}…`,
        href: "/admin/inventario",
      });
    }
  }

  // 5) Sin compra de pollo registrada en más de 2 días
  const lastPoultry = recentDPs.find((dp) => {
    const prod = dp.products as unknown as { category: string } | null;
    return prod?.category === "poultry";
  });
  if (lastPoultry?.purchase_date) {
    const daysSince =
      (now - new Date(lastPoultry.purchase_date as string).getTime()) / DAY;
    if (daysSince > 2) {
      alerts.push({
        id: "sin-pollo",
        severity: "warning",
        icon: "bird",
        title: "Sin compra de pollo reciente",
        description: `${Math.floor(daysSince)} días desde la última`,
        href: "/admin/entradas",
      });
    }
  } else {
    alerts.push({
      id: "sin-pollo-jamas",
      severity: "warning",
      icon: "bird",
      title: "Sin compras de pollo registradas",
      href: "/admin/entradas",
    });
  }

  return alerts;
}
