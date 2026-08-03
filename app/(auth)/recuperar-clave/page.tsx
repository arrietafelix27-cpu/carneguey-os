import Link from "next/link";
import { RecoverForm } from "./recover-form";

export const metadata = { title: "Recuperar contraseña" };

export default function RecuperarClavePage() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-secondary px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Recuperar contraseña
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Te enviamos un enlace para crear una nueva.
          </p>
        </div>

        <div className="rounded-3xl bg-card p-6 shadow-md sm:p-8">
          <RecoverForm />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link href="/login" className="text-primary">
            Volver a entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
