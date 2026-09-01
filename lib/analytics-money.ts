import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bogotaToday } from "@/lib/dates";

/**
 * Analítica de dinero — lo que el dueño realmente quiere saber.
 *
 * Hasta ahora la Analítica solo medía merma y rendimiento: cuánto pesa lo que
 * entra contra lo que sale. Nada de plata. El dueño no podía responder
 * "¿cuánto vendí este mes?", "¿estoy ganando?", "¿qué producto me deja más?".
 *
 * El costo de lo vendido sale de `inventory_movements`: cada venta genera un
 * movimiento con `unit_cost` = costo promedio del producto en ese momento
 * (lo calcula la base, nunca el cliente). Así que la utilidad es real, no
 * estimada a ojo.
 *
 * Todo esto es solo-admin: las tablas de dinero tienen RLS solo-admin, así
 * que una cajera no obtiene ni una fila por ninguna vía.
 */

export type PeriodMoney = {
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
  saleCount: number;
  averageTicket: number;
};

export type ProductProfit = {
  productId: string;
  name: string;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
  quantity: number;
  unit: string;
};

export type MoneySnapshot = {
  today: PeriodMoney;
  todayByMethod: { cash: number; card: number; transfer: number; credit: number };
  month: PeriodMoney;
  previousMonth: PeriodMoney;
  /** Variación % de ventas contra el mes pasado, a la misma altura del mes. */
  monthVsPreviousPct: number | null;
  topProducts: ProductProfit[];
  outflowsMonth: number;
};

const EMPTY: PeriodMoney = {
  revenue: 0,
  cost: 0,
  profit: 0,
  marginPct: 0,
  saleCount: 0,
  averageTicket: 0,
};

function startOfMonth(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

function shiftMonths(yyyymm: string, delta: number): string {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Instantes ISO que cubren [from, to] completos en hora de Colombia. */
function bounds(from: string, to: string) {
  return { start: `${from}T00:00:00-05:00`, end: `${to}T23:59:59.999-05:00` };
}

function summarize(
  revenue: number,
  cost: number,
  saleCount: number,
): PeriodMoney {
  const profit = revenue - cost;
  return {
    revenue: Math.round(revenue),
    cost: Math.round(cost),
    profit: Math.round(profit),
    marginPct: revenue > 0 ? (profit / revenue) * 100 : 0,
    saleCount,
    averageTicket: saleCount > 0 ? Math.round(revenue / saleCount) : 0,
  };
}

/**
 * Ingresos y costo de un rango. El costo sale de los movimientos de
 * inventario de tipo 'sale' (cantidad negativa × costo unitario).
 */
async function periodMoney(
  supabase: SupabaseClient,
  from: string,
  to: string,
): Promise<PeriodMoney> {
  const { start, end } = bounds(from, to);

  const [{ data: sales }, { data: movements }] = await Promise.all([
    supabase
      .from("sales")
      .select("id, total")
      .neq("status", "cancelled")
      .gte("created_at", start)
      .lte("created_at", end),
    supabase
      .from("inventory_movements")
      .select("quantity, unit_cost")
      .eq("movement_type", "sale")
      .gte("created_at", start)
      .lte("created_at", end),
  ]);

  const revenue = (sales ?? []).reduce((s, r) => s + Number(r.total ?? 0), 0);
  const cost = (movements ?? []).reduce(
    (s, m) => s + Math.abs(Number(m.quantity ?? 0)) * Number(m.unit_cost ?? 0),
    0,
  );
  return summarize(revenue, cost, (sales ?? []).length);
}

export async function getMoneySnapshot(
  supabase: SupabaseClient,
): Promise<MoneySnapshot> {
  const today = bogotaToday();
  const monthStart = startOfMonth(today);
  const prevMonth = shiftMonths(today.slice(0, 7), -1);
  const prevMonthStart = `${prevMonth}-01`;
  // Misma altura del mes pasado, para que la comparación sea justa: si hoy es
  // 8 del mes, se compara contra el 1–8 del mes pasado, no contra el mes
  // completo.
  const dayOfMonth = Number(today.slice(8, 10));
  const prevMonthSameDay = `${prevMonth}-${String(dayOfMonth).padStart(2, "0")}`;

  const { start: monthStartIso, end: monthEndIso } = bounds(monthStart, today);

  const [
    todayMoney,
    monthMoney,
    prevMoney,
    { data: todaySales },
    { data: monthItems },
    { data: monthCostMovs },
    { data: products },
    { data: outflows },
  ] = await Promise.all([
    periodMoney(supabase, today, today),
    periodMoney(supabase, monthStart, today),
    periodMoney(supabase, prevMonthStart, prevMonthSameDay),
    supabase
      .from("sales")
      .select("payment_method, total")
      .neq("status", "cancelled")
      .gte("created_at", bounds(today, today).start)
      .lte("created_at", bounds(today, today).end),
    // Ingreso por producto del mes.
    supabase
      .from("sale_items")
      .select("product_id, quantity, total_price, sales!inner(created_at, status)")
      .gte("sales.created_at", monthStartIso)
      .lte("sales.created_at", monthEndIso)
      .neq("sales.status", "cancelled"),
    // Costo por producto del mes.
    supabase
      .from("inventory_movements")
      .select("product_id, quantity, unit_cost")
      .eq("movement_type", "sale")
      .gte("created_at", monthStartIso)
      .lte("created_at", monthEndIso),
    supabase.from("products").select("id, name, unit"),
    supabase
      .from("cash_outflows")
      .select("amount")
      .eq("status", "approved")
      .gte("created_at", monthStartIso)
      .lte("created_at", monthEndIso),
  ]);

  const todayByMethod = { cash: 0, card: 0, transfer: 0, credit: 0 };
  for (const s of todaySales ?? []) {
    const m = s.payment_method as keyof typeof todayByMethod;
    if (m in todayByMethod) todayByMethod[m] += Number(s.total ?? 0);
  }
  for (const k of Object.keys(todayByMethod) as (keyof typeof todayByMethod)[]) {
    todayByMethod[k] = Math.round(todayByMethod[k]);
  }

  // Utilidad por producto.
  const nameOf = new Map(
    (products ?? []).map((p) => [
      p.id as string,
      { name: p.name as string, unit: p.unit as string },
    ]),
  );
  const acc = new Map<
    string,
    { revenue: number; cost: number; quantity: number }
  >();
  const bump = (
    id: string,
    patch: Partial<{ revenue: number; cost: number; quantity: number }>,
  ) => {
    const cur = acc.get(id) ?? { revenue: 0, cost: 0, quantity: 0 };
    acc.set(id, {
      revenue: cur.revenue + (patch.revenue ?? 0),
      cost: cur.cost + (patch.cost ?? 0),
      quantity: cur.quantity + (patch.quantity ?? 0),
    });
  };
  for (const it of monthItems ?? []) {
    bump(it.product_id as string, {
      revenue: Number(it.total_price ?? 0),
      quantity: Number(it.quantity ?? 0),
    });
  }
  for (const m of monthCostMovs ?? []) {
    bump(m.product_id as string, {
      cost: Math.abs(Number(m.quantity ?? 0)) * Number(m.unit_cost ?? 0),
    });
  }

  const topProducts: ProductProfit[] = [...acc.entries()]
    .map(([productId, v]) => {
      const info = nameOf.get(productId);
      const profit = v.revenue - v.cost;
      return {
        productId,
        name: info?.name ?? "Producto",
        unit: info?.unit ?? "kg",
        revenue: Math.round(v.revenue),
        cost: Math.round(v.cost),
        profit: Math.round(profit),
        marginPct: v.revenue > 0 ? (profit / v.revenue) * 100 : 0,
        quantity: v.quantity,
      };
    })
    .filter((p) => p.revenue > 0)
    .sort((a, b) => b.profit - a.profit);

  const monthVsPreviousPct =
    prevMoney.revenue > 0
      ? ((monthMoney.revenue - prevMoney.revenue) / prevMoney.revenue) * 100
      : null;

  return {
    today: todayMoney ?? EMPTY,
    todayByMethod,
    month: monthMoney,
    previousMonth: prevMoney,
    monthVsPreviousPct,
    topProducts,
    outflowsMonth: Math.round(
      (outflows ?? []).reduce((s, o) => s + Number(o.amount ?? 0), 0),
    ),
  };
}
