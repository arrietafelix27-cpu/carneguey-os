import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar · Carnegüey OS",
};

export default function LoginPage() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-secondary px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="grid size-16 place-items-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
            CG
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-primary">
              Carnegüey OS
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sistema de gestión interno
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Acceso exclusivo para el personal de Carnegüey.
        </p>
      </div>
    </main>
  );
}
