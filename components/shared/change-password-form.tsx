"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { newPasswordSchema, type NewPasswordInput } from "@/lib/validations/auth";
import { changePassword } from "@/lib/actions/password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Formulario de nueva contraseña. Sirve para el cambio voluntario, el forzado
 * en primer login y el de recuperación por correo (todos terminan llamando
 * a changePassword con la sesión activa).
 */
export function ChangePasswordForm({ submitLabel = "Guardar" }: { submitLabel?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  function onSubmit(values: NewPasswordInput) {
    startTransition(async () => {
      const r = await changePassword(values.password);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Contraseña actualizada");
      router.push("/");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="password">Nueva contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="confirm">Confirmar contraseña</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          placeholder="Repite la contraseña"
          aria-invalid={!!errors.confirm}
          {...register("confirm")}
        />
        {errors.confirm && (
          <p className="text-sm text-destructive">{errors.confirm.message}</p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="h-12 w-full text-base font-semibold transition-transform active:scale-[0.98]"
      >
        {isPending && <Loader2 className="size-4 animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  );
}
