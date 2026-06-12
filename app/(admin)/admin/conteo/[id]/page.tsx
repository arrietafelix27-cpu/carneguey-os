import { redirect } from "next/navigation";

export default async function ConteoIdRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/conteos/${id}`);
}
