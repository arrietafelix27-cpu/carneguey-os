import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Historial de actividad — todo lo que hizo el equipo, en un solo lugar.
 *
 * Idea de Félix: aunque el dueño le suelte acciones a la cajera (ver
 * `lib/permissions.ts`), tiene que quedar el rastro de lo que hizo por su
 * cuenta. Los datos siempre existieron — cada tabla guarda `created_by` — pero
 * nunca hubo una pantalla que los juntara.
 *
 * Esto es solo lectura y solo para el admin: la RLS de las tablas con dinero
 * (sales, cash_outflows, etc.) ya lo garantiza. Si una cajera llegara a la
 * URL, no le vuelve ni una fila.
 *
 * Las acciones que se aplicaron SIN pasar por el dueño se marcan con
 * `unsupervised`: son las que de verdad quiere revisar.
 */

export type ActivityKind =
  | "sale"
  | "sale_void"
  | "sale_return"
  | "purchase_lot"
  | "direct_purchase"
  | "desposte"
  | "cut_transfer"
  | "sub_desposte"
  | "cash_outflow"
  | "credit_payment"
  | "supplier_payment"
  | "day_closing"
  | "count";

export type ActivityEvent = {
  id: string;
  at: string;
  kind: ActivityKind;
  who: string;
  whoId: string;
  title: string;
  detail: string;
  amount: number | null;
  /** Acción delicada que se aplicó sin pasar por el dueño. */
  unsupervised: boolean;
  href: string | null;
};

export type ActivityFilters = {
  from: string;
  to: string;
  userId?: string;
  onlyUnsupervised?: boolean;
};

const KIND_LABEL: Record<ActivityKind, string> = {
  sale: "Venta",
  sale_void: "Anulación de venta",
  sale_return: "Devolución",
  purchase_lot: "Compra de lote",
  direct_purchase: "Compra directa",
  desposte: "Desposte",
  cut_transfer: "Transferencia de cortes",
  sub_desposte: "Sub-desposte",
  cash_outflow: "Salida de efectivo",
  credit_payment: "Abono de cliente",
  supplier_payment: "Pago a proveedor",
  day_closing: "Cierre de caja",
  count: "Conteo",
};

export function activityLabel(kind: ActivityKind): string {
  return KIND_LABEL[kind];
}

const PAY_LABEL: Record<string, string> = {
  cash: "efectivo",
  card: "tarjeta",
  transfer: "transferencia",
  credit: "crédito",
};

const OUTFLOW_LABEL: Record<string, string> = {
  sf: "salida de fondo",
  employee_advance: "adelanto a empleado",
  expense: "gasto",
  supplier_payment: "pago a proveedor",
};

/** Rango [from, to] en hora de Colombia, como instantes ISO para comparar. */
function range(filters: ActivityFilters) {
  return {
    start: `${filters.from}T00:00:00-05:00`,
    end: `${filters.to}T23:59:59.999-05:00`,
  };
}

export async function getActivity(
  supabase: SupabaseClient,
  filters: ActivityFilters,
): Promise<ActivityEvent[]> {
  const { start, end } = range(filters);
  const between = <T>(q: T): T =>
    (q as { gte: (c: string, v: string) => { lte: (c: string, v: string) => T } })
      .gte("created_at", start)
      .lte("created_at", end);

  const [
    profilesRes,
    salesRes,
    adjustmentsRes,
    lotsRes,
    directRes,
    despostesRes,
    transfersRes,
    subsRes,
    outflowsRes,
    creditPaymentsRes,
    supplierPaymentsRes,
    closingsRes,
    countsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name"),
    between(
      supabase
        .from("sales")
        .select("id, created_at, created_by, payment_method, total, status"),
    ),
    supabase
      .from("sale_adjustments")
      .select(
        "id, sale_id, kind, status, total_amount, restock, refund_method, requested_by, requested_at, reviewed_by, applied_at",
      )
      .gte("requested_at", start)
      .lte("requested_at", end),
    between(
      supabase
        .from("purchase_lots")
        .select("id, created_at, created_by, lot_code, type"),
    ),
    between(
      supabase
        .from("direct_purchases")
        .select("id, created_at, created_by, quantity, products(name, unit)"),
    ),
    supabase
      .from("despostes")
      .select("id, created_by, finalized_at, input_weight_kg, purchase_lots(lot_code)")
      .eq("status", "finalized")
      .gte("finalized_at", start)
      .lte("finalized_at", end),
    between(
      supabase
        .from("cut_transfers")
        .select("id, created_at, created_by, quantity_kg, status, reviewed_by"),
    ),
    between(
      supabase
        .from("sub_despostes")
        .select("id, created_at, created_by, source_kg, status, reviewed_by"),
    ),
    between(
      supabase
        .from("cash_outflows")
        .select("id, created_at, created_by, amount, category, status, approved_by"),
    ),
    between(
      supabase
        .from("credit_payments")
        .select("id, created_at, created_by, amount, payment_method"),
    ),
    between(
      supabase
        .from("supplier_payments")
        .select("id, created_at, created_by, amount, payment_method"),
    ),
    between(
      supabase
        .from("daily_closings")
        .select("id, created_at, created_by, closing_date, difference, status"),
    ),
    between(
      supabase
        .from("physical_counts")
        .select("id, created_at, created_by, status, count_date"),
    ),
  ]);

  const nameOf = new Map(
    (profilesRes.data ?? []).map((p) => [
      p.id as string,
      p.full_name as string,
    ]),
  );
  const who = (id: string | null) =>
    (id && nameOf.get(id)) || "Usuario eliminado";

  const events: ActivityEvent[] = [];
  const push = (e: ActivityEvent) => events.push(e);

  for (const s of salesRes.data ?? []) {
    const method = PAY_LABEL[s.payment_method as string] ?? "";
    push({
      id: `sale-${s.id}`,
      at: s.created_at as string,
      kind: "sale",
      who: who(s.created_by as string),
      whoId: s.created_by as string,
      title: "Venta registrada",
      detail:
        s.status === "cancelled"
          ? `Anulada · ${method}`
          : s.status === "returned"
            ? `Con devolución · ${method}`
            : `Pagada en ${method}`,
      amount: Number(s.total ?? 0),
      unsupervised: false,
      href: "/admin/ventas",
    });
  }

  for (const a of adjustmentsRes.data ?? []) {
    const isVoid = a.kind === "void";
    const status = a.status as string;
    // Se aplicó sin pasar por el dueño: quien pidió es quien aparece como
    // revisor (la acción estaba suelta en la configuración).
    const alone =
      status === "approved" && a.reviewed_by === a.requested_by;
    const statusText =
      status === "pending"
        ? "Esperando aprobación"
        : status === "rejected"
          ? "Rechazada"
          : alone
            ? "Aplicada sin aprobación"
            : "Aprobada";
    push({
      id: `adj-${a.id}`,
      at: (a.applied_at as string) ?? (a.requested_at as string),
      kind: isVoid ? "sale_void" : "sale_return",
      who: who(a.requested_by as string),
      whoId: a.requested_by as string,
      title: isVoid ? "Anuló una venta" : "Hizo una devolución",
      detail: isVoid
        ? statusText
        : `${statusText} · ${
            a.refund_method === "credit_note"
              ? "se le bajó la deuda"
              : "efectivo"
          } · ${a.restock ? "volvió al inventario" : "producto perdido"}`,
      amount: Number(a.total_amount ?? 0),
      unsupervised: alone,
      href: "/admin/devoluciones",
    });
  }

  for (const l of lotsRes.data ?? []) {
    push({
      id: `lot-${l.id}`,
      at: l.created_at as string,
      kind: "purchase_lot",
      who: who(l.created_by as string),
      whoId: l.created_by as string,
      title: `Registró el lote ${l.lot_code}`,
      detail: "Compra de mercancía",
      amount: null,
      unsupervised: false,
      href: `/admin/lotes/${l.id}`,
    });
  }

  for (const d of directRes.data ?? []) {
    const prod = d.products as unknown as {
      name: string;
      unit: string;
    } | null;
    push({
      id: `dp-${d.id}`,
      at: d.created_at as string,
      kind: "direct_purchase",
      who: who(d.created_by as string),
      whoId: d.created_by as string,
      title: `Compró ${prod?.name ?? "un producto"}`,
      detail: `${Number(d.quantity ?? 0)} ${prod?.unit === "unit" ? "unidades" : "kg"}`,
      amount: null,
      unsupervised: false,
      href: "/admin/entradas",
    });
  }

  for (const d of despostesRes.data ?? []) {
    const lot = d.purchase_lots as unknown as { lot_code: string } | null;
    push({
      id: `desp-${d.id}`,
      at: d.finalized_at as string,
      kind: "desposte",
      who: who(d.created_by as string),
      whoId: d.created_by as string,
      title: `Terminó un desposte${lot ? ` del lote ${lot.lot_code}` : ""}`,
      detail: `Entraron ${Number(d.input_weight_kg ?? 0)} kg`,
      amount: null,
      unsupervised: false,
      href: `/admin/despostes/${d.id}`,
    });
  }

  for (const t of transfersRes.data ?? []) {
    const alone =
      t.status === "approved" && t.reviewed_by === t.created_by;
    push({
      id: `ct-${t.id}`,
      at: t.created_at as string,
      kind: "cut_transfer",
      who: who(t.created_by as string),
      whoId: t.created_by as string,
      title: "Transfirió cortes",
      detail: `${Number(t.quantity_kg ?? 0)} kg · ${
        t.status === "pending"
          ? "Esperando aprobación"
          : t.status === "rejected"
            ? "Rechazada"
            : alone
              ? "Aplicada sin aprobación"
              : "Aprobada"
      }`,
      amount: null,
      unsupervised: alone,
      href: "/admin/transferencias",
    });
  }

  for (const s of subsRes.data ?? []) {
    const alone =
      s.status === "approved" && s.reviewed_by === s.created_by;
    push({
      id: `sd-${s.id}`,
      at: s.created_at as string,
      kind: "sub_desposte",
      who: who(s.created_by as string),
      whoId: s.created_by as string,
      title: "Hizo un sub-desposte",
      detail: `${Number(s.source_kg ?? 0)} kg · ${
        s.status === "pending"
          ? "Esperando aprobación"
          : s.status === "rejected"
            ? "Rechazado"
            : alone
              ? "Aplicado sin aprobación"
              : "Aprobado"
      }`,
      amount: null,
      unsupervised: alone,
      href: "/admin/sub-despostes",
    });
  }

  for (const o of outflowsRes.data ?? []) {
    const alone = o.status === "approved" && o.approved_by == null;
    push({
      id: `co-${o.id}`,
      at: o.created_at as string,
      kind: "cash_outflow",
      who: who(o.created_by as string),
      whoId: o.created_by as string,
      title: `Sacó efectivo — ${OUTFLOW_LABEL[o.category as string] ?? o.category}`,
      detail:
        o.status === "pending"
          ? "Esperando aprobación"
          : o.status === "rejected"
            ? "Rechazado"
            : alone
              ? "Sin aprobación"
              : "Aprobado",
      amount: Number(o.amount ?? 0),
      unsupervised: alone,
      href: "/admin/egresos",
    });
  }

  for (const p of creditPaymentsRes.data ?? []) {
    push({
      id: `cp-${p.id}`,
      at: p.created_at as string,
      kind: "credit_payment",
      who: who(p.created_by as string),
      whoId: p.created_by as string,
      title: "Recibió un abono",
      detail: `En ${PAY_LABEL[p.payment_method as string] ?? "efectivo"}`,
      amount: Number(p.amount ?? 0),
      unsupervised: false,
      href: "/admin/clientes",
    });
  }

  for (const p of supplierPaymentsRes.data ?? []) {
    push({
      id: `sp-${p.id}`,
      at: p.created_at as string,
      kind: "supplier_payment",
      who: who(p.created_by as string),
      whoId: p.created_by as string,
      title: "Pagó a un proveedor",
      detail: `En ${PAY_LABEL[p.payment_method as string] ?? "efectivo"}`,
      amount: Number(p.amount ?? 0),
      unsupervised: false,
      href: "/admin/proveedores",
    });
  }

  for (const c of closingsRes.data ?? []) {
    const diff = Number(c.difference ?? 0);
    push({
      id: `dc-${c.id}`,
      at: c.created_at as string,
      kind: "day_closing",
      who: who(c.created_by as string),
      whoId: c.created_by as string,
      title: "Cerró la caja del día",
      detail:
        Math.abs(diff) < 1
          ? "Cuadró exacto"
          : diff > 0
            ? `Sobró ${Math.round(diff)}`
            : `Faltó ${Math.abs(Math.round(diff))}`,
      amount: null,
      unsupervised: false,
      href: `/admin/cuadre/${c.id}`,
    });
  }

  for (const c of countsRes.data ?? []) {
    push({
      id: `pc-${c.id}`,
      at: c.created_at as string,
      kind: "count",
      who: who(c.created_by as string),
      whoId: c.created_by as string,
      title:
        c.status === "completed"
          ? "Terminó un conteo"
          : c.status === "cancelled"
            ? "Canceló un conteo"
            : "Empezó un conteo",
      detail: "Conteo quincenal",
      amount: null,
      unsupervised: false,
      href: `/admin/conteos/${c.id}`,
    });
  }

  let result = events;
  if (filters.userId) {
    result = result.filter((e) => e.whoId === filters.userId);
  }
  if (filters.onlyUnsupervised) {
    result = result.filter((e) => e.unsupervised);
  }

  return result.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
