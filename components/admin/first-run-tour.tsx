"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Boxes,
  Wallet,
  ScanLine,
  UsersRound,
  ChevronRight,
  X,
  type LucideIcon,
} from "lucide-react";
import { PRODUCT_NAME } from "@/lib/config";
import { Button } from "@/components/ui/button";

/**
 * Tutorial de la primera vez.
 *
 * Le explica al dueño de qué se trata cada parte, en su idioma, y termina
 * contándole las acciones delicadas — pero SIN pedirle que tome siete
 * decisiones de seguridad a los tres minutos de abrir la app, cuando todavía
 * no sabe qué es un sub-desposte. Le dice cómo viene configurado y dónde
 * cambiarlo cuando ya conozca a su gente.
 *
 * Se guarda en el navegador, no en la base: es una ayuda de la primera vez,
 * no un dato del negocio. Si el dueño entra desde otro dispositivo y lo ve de
 * nuevo, no pasa nada.
 */

const KEY = "miura.first-run.v1";

type Step = {
  icon: LucideIcon;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    icon: ScanLine,
    title: `Bienvenido a ${PRODUCT_NAME}`,
    body: "Esto es a la vez la caja registradora de tu negocio y el lugar donde administras todo: lo que compras, lo que despostas, lo que vendes y la plata que entra y sale. Te muestro lo principal en 30 segundos.",
  },
  {
    icon: Boxes,
    title: "Inventario y merma",
    body: "Cada compra que entra y cada desposte que hacen tus carniceros queda registrado. La app te dice cuánto debería haber de cada producto y cuánta carne se perdió en el camino. Ese control de merma es el corazón del sistema.",
  },
  {
    icon: Wallet,
    title: "Tu plata, clara",
    body: "En Inicio ves lo que vendiste hoy y lo que llevas en el mes, con tu ganancia real: lo vendido menos lo que te costó esa carne. En Dinero ves qué producto te deja más y cuál te está costando plata.",
  },
  {
    icon: UsersRound,
    title: "Tu equipo",
    body: "Tus cajeras entran con su propio usuario y nunca ven costos, márgenes ni cuánto ganas. Todo lo que hacen queda registrado con su nombre y la hora, y eso no se puede borrar ni editar.",
  },
  {
    icon: ShieldCheck,
    title: "Acciones delicadas",
    body: "Hay cosas que mueven plata o inventario: anular una venta, hacer una devolución, sacar efectivo de la caja. De fábrica esas te piden aprobación a ti, y las que no mueven plata quedan sueltas para que tu gente no se frene. Cuando conozcas a tu equipo, tú decides qué soltar y qué no.",
  },
];

export function FirstRunTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {
      // Almacenamiento bloqueado: simplemente no se muestra el tutorial.
    }
  }, []);

  const close = useCallback(() => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // Sin almacenamiento se volverá a ver; es preferible a que falle.
    }
    setOpen(false);
  }, []);

  if (!open) return null;

  const s = STEPS[step];
  const Icon = s.icon;
  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-lg">
        <div className="mb-5 flex items-start justify-between gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--brand-red-soft)] text-primary">
            <Icon className="size-6" strokeWidth={2} />
          </span>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar tutorial"
            className="rounded-full p-1.5 text-muted-foreground transition-colors active:bg-secondary"
          >
            <X className="size-5" />
          </button>
        </div>

        <h2 className="text-[22px] font-bold leading-tight tracking-tight text-foreground">
          {s.title}
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-secondary-foreground">
          {s.body}
        </p>

        {last && (
          <Link
            href="/admin/configuracion/acciones"
            onClick={close}
            className="mt-4 flex items-center gap-3 rounded-2xl bg-secondary px-4 py-3 transition-opacity active:opacity-70"
          >
            <span className="flex-1 text-[14px] font-medium text-foreground">
              Ver cómo quedó configurado
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        )}

        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="flex gap-1.5" aria-hidden>
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-5 bg-primary" : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!last && (
              <button
                type="button"
                onClick={close}
                className="text-[15px] font-medium text-secondary-foreground transition-opacity active:opacity-60"
              >
                Saltar
              </button>
            )}
            <Button onClick={last ? close : () => setStep(step + 1)}>
              {last ? "Empezar" : "Siguiente"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
