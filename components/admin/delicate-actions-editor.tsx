"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Unlock, Camera, CameraOff } from "lucide-react";
import { updateDelicateActions } from "@/lib/actions/settings";
import {
  PERMISSION_INFO,
  RECEIPT_INFO,
  POLICY_KEYS,
  type PolicyKey,
  type Policies,
} from "@/lib/permissions";
import { Button } from "@/components/ui/button";

type Row = {
  key: PolicyKey;
  label: string;
  description: string;
  onLabel: string;
  offLabel: string;
};

const ACTION_ROWS: Row[] = PERMISSION_INFO.map((p) => ({
  ...p,
  onLabel: "Puede sola",
  offLabel: "Tu aprobación",
}));

const RECEIPT_ROWS: Row[] = RECEIPT_INFO.map((r) => ({
  ...r,
  onLabel: "Exige foto",
  offLabel: "Foto opcional",
}));

export function DelicateActionsEditor({
  permissions,
}: {
  permissions: Policies;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Policies>(permissions);
  const [isPending, startTransition] = useTransition();

  const dirty = POLICY_KEYS.some((key) => values[key] !== permissions[key]);

  const toggle = useCallback((key: PolicyKey) => {
    setValues((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const save = useCallback(() => {
    startTransition(async () => {
      const result = await updateDelicateActions(values);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Configuración guardada");
      router.refresh();
    });
  }, [values, router]);

  return (
    <>
      <Section
        title="Qué puede hacer tu equipo sin preguntarte"
        rows={ACTION_ROWS}
        values={values}
        onToggle={toggle}
        variant="permission"
      />

      <Section
        title="De qué se exige foto del comprobante"
        rows={RECEIPT_ROWS}
        values={values}
        onToggle={toggle}
        variant="receipt"
      />

      <div className="mt-6 flex items-center justify-end gap-3">
        {dirty && (
          <button
            type="button"
            onClick={() => setValues(permissions)}
            className="text-[15px] font-medium text-secondary-foreground transition-opacity active:opacity-60"
          >
            Descartar
          </button>
        )}
        <Button className="gap-2" disabled={!dirty || isPending} onClick={save}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Guardar cambios
        </Button>
      </div>
    </>
  );
}

function Section({
  title,
  rows,
  values,
  onToggle,
  variant,
}: {
  title: string;
  rows: Row[];
  values: Policies;
  onToggle: (key: PolicyKey) => void;
  variant: "permission" | "receipt";
}) {
  const OnIcon = variant === "permission" ? Unlock : Camera;
  const OffIcon = variant === "permission" ? ShieldCheck : CameraOff;
  // En permisos, "encendido" es soltar la acción (rojo de marca).
  // En comprobantes, "encendido" es exigir foto — es lo estricto, así que el
  // color de énfasis va al revés para que la pantalla no mienta visualmente.
  const emphasizeOn = variant === "permission";

  return (
    <section className="mb-8">
      <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        {title}
      </h2>
      <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
        {rows.map(({ key, label, description, onLabel, offLabel }, i) => {
          const on = values[key];
          const emphasized = on === emphasizeOn;
          const Icon = on ? OnIcon : OffIcon;
          return (
            <li
              key={key}
              className={i > 0 ? "border-t border-border/60" : undefined}
            >
              <div className="flex items-start gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-foreground">
                    {label}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                    {description}
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${label}: ${on ? onLabel : offLabel}`}
                  onClick={() => onToggle(key)}
                  className={`mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    emphasized
                      ? "bg-[var(--brand-red-soft)] text-primary"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  <Icon className="size-3.5" strokeWidth={2.5} />
                  {on ? onLabel : offLabel}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
