import { getCurrentProfile } from "@/lib/auth";
import { ProfileMenu } from "@/components/shared/profile-menu";
import { EmployeeNav } from "@/components/employee/employee-nav";

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  return (
    <div className="min-h-[100dvh] bg-secondary pb-20">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
        <span className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            CG
          </span>
          <span className="text-base font-bold tracking-tight text-primary">
            Carnegüey
          </span>
        </span>
        <ProfileMenu fullName={profile.full_name} />
      </header>
      {children}
      <EmployeeNav />
    </div>
  );
}
