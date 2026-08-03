"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2, ShieldCheck, ScanLine } from "lucide-react";
import {
  createTeamUser,
  setTeamUserActive,
  type TeamMember,
} from "@/lib/actions/team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  employee: "Caja",
};

type FormState = {
  full_name: string;
  email: string;
  role: "admin" | "employee";
  password: string;
};

const EMPTY: FormState = {
  full_name: "",
  email: "",
  role: "employee",
  password: "",
};

export function TeamManager({ team }: { team: TeamMember[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setForm(EMPTY);
    setDialogOpen(true);
  }

  function submit() {
    startTransition(async () => {
      const r = await createTeamUser(form);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Usuario creado. Deberá cambiar la contraseña al entrar.");
      setDialogOpen(false);
      router.refresh();
    });
  }

  function toggleActive(m: TeamMember) {
    startTransition(async () => {
      const r = await setTeamUserActive(m.id, !m.active);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(m.active ? "Usuario desactivado" : "Usuario reactivado");
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" />
          Nuevo usuario
        </Button>
      </div>

      {team.length === 0 ? (
        <div className="rounded-3xl bg-card px-6 py-12 text-center text-[15px] text-secondary-foreground shadow-sm">
          Aún no hay usuarios.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
          {team.map((m, i) => (
            <li
              key={m.id}
              className={`flex items-center gap-3 px-4 py-3.5 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-[var(--radius-md)] ${
                  m.role === "admin"
                    ? "bg-[var(--brand-red-soft)] text-primary"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {m.role === "admin" ? (
                  <ShieldCheck className="size-5" />
                ) : (
                  <ScanLine className="size-5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">
                  {m.fullName}
                  {!m.active && (
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                      Inactivo
                    </span>
                  )}
                </p>
                <p className="truncate text-[13px] text-secondary-foreground">
                  {m.email} · {ROLE_LABEL[m.role]}
                </p>
              </div>
              <Button
                variant={m.active ? "secondary" : "default"}
                size="sm"
                disabled={isPending}
                onClick={() => toggleActive(m)}
              >
                {m.active ? "Desactivar" : "Reactivar"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="tname">Nombre</Label>
              <Input
                id="tname"
                autoFocus
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="temail">Correo</Label>
              <Input
                id="temail"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                placeholder="persona@ejemplo.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Rol</Label>
              <Select
                value={form.role}
                onValueChange={(v) =>
                  setForm({ ...form, role: (v as FormState["role"]) ?? "employee" })
                }
              >
                <SelectTrigger>
                  <span>{ROLE_LABEL[form.role]}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Caja</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tpass">Contraseña temporal</Label>
              <Input
                id="tpass"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Mínimo 8 caracteres"
              />
              <p className="text-[12px] text-secondary-foreground">
                El usuario deberá cambiarla la primera vez que entre.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setDialogOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button className="gap-2" disabled={isPending} onClick={submit}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
