import { redirect } from "next/navigation";

// El middleware ya enruta según sesión/rol. Este redirect es el respaldo.
export default function RootPage() {
  redirect("/login");
}
