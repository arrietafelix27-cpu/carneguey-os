"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import { resetRequestSchema, type ResetRequestInput } from "@/lib/validations/auth";
import { requestPasswordReset } from "@/lib/actions/password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RecoverForm() {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetRequestInput>({
    resolver: zodResolver(resetRequestSchema),
    defaultValues: { email: "" },
  });

  function onSubmit(values: ResetRequestInput) {
    startTransition(async () => {
      await requestPasswordReset(values.email);
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-[var(--brand-red-soft)] text-primary">
          <MailCheck className="size-6" />
        </div>
        <p className="text-[15px] text-foreground">
          Si el correo está registrado, te llegará un enlace para crear una
          nueva contraseña.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="email">Correo</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          placeholder="tucorreo@ejemplo.com"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="h-12 w-full text-base font-semibold transition-transform active:scale-[0.98]"
      >
        {isPending && <Loader2 className="size-4 animate-spin" />}
        Enviar enlace
      </Button>
    </form>
  );
}
