"use client";

import { useTransition } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { logout } from "@/lib/actions/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function ProfileMenu({ fullName }: { fullName: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="grid size-10 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-transform active:scale-95"
        aria-label="Menú de perfil"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          initials(fullName)
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{fullName}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => startTransition(() => logout())}
        >
          <LogOut className="size-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
