import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { AppNav } from "@/components/shared/app-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin") redirect("/empleado");

  return (
    <div className="min-h-[100dvh] bg-secondary">
      <AppNav role="admin" fullName={profile.full_name} />
      <div className="pb-24 lg:pb-0 lg:pl-[15%]">{children}</div>
    </div>
  );
}
