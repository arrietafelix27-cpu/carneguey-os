import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { AppNav } from "@/components/shared/app-nav";

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // El rol del que mira decide la navegación: si el admin entra al POS
  // (que vive bajo /empleado), sigue viendo SU barra de admin.
  const profile = await getCurrentProfile();
  if (profile.must_change_password) redirect("/cambiar-clave");

  return (
    <div className="min-h-[100dvh] bg-secondary">
      <AppNav role={profile.role} fullName={profile.full_name} />
      <div className="pb-24 lg:pb-0 lg:pl-[15%]">{children}</div>
    </div>
  );
}
