"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Unlock } from "lucide-react";
import { updateDelicateActions } from "@/lib/actions/settings";
import {
  PERMISSION_INFO,
  type PermissionKey,
  type Permissions,
} from "@/lib/permissions";
import { Button } from "@/components/ui/button";

export function DelicateActionsEditor({
  permissions,
}: {
  permissions: Permissions;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Permissions>(permissions);
  const [isPending, startTransition] = useTransition();

  const dirty = PERMISSION_INFO.some(
    ({ key }) => values[key] !== permissions[key],
  );

  const toggle = useCallback((key: PermissionKey) => {
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
      <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
        {PERMISSION_INFO.map(({ key, label, description, pending }, i) => {
          const isFree = values[key];
          return (
            <li
              key={key}
              className={i > 0 ? "border-t border-border/60" : undefined}
            >
              <div className="flex items-start gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-foreground">
                    {label}
                    {pending && (
                      <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 align-middle text-[11px] font-medium text-secondary-foreground">
                        Próximamente
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                    {description}
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={isFree}
                  aria-label={`${label}: ${
                    isFree ? "la cajera puede sola" : "necesita tu aprobación"
                  }`}
                  onClick={() => toggle(key)}
                  className={`mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    isFree
                      ? "bg-[var(--brand-red-soft)] text-primary"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {isFree ? (
                    <Unlock className="size-3.5" strokeWidth={2.5} />
                  ) : (
                    <ShieldCheck className="size-3.5" strokeWidth={2.5} />
                  )}
                  {isFree ? "Puede sola" : "Tu aprobación"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

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
