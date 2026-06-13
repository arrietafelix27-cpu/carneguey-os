import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { ProfileMenu } from "@/components/shared/profile-menu";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin") redirect("/empleado");

  return (
    <div className="min-h-[100dvh] bg-secondary">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border/70 bg-card/80 px-4 py-3 backdrop-blur-xl sm:px-6">
        <Link href="/admin" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-[var(--shadow-brand)]">
            CG
          </span>
          <span className="text-[15px] font-bold tracking-tight text-foreground">
            Carnegüey OS
          </span>
        </Link>
        <ProfileMenu
          fullName={profile.full_name}
          configHref="/admin/configuracion"
        />
      </header>
      {children}
    </div>
  );
}
