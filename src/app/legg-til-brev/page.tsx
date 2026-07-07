import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LeggTilBrevFlyt } from "./LeggTilBrevFlyt";

export default async function LeggTilBrevPage({
  searchParams,
}: {
  searchParams: Promise<{ krav?: string }>;
}) {
  const { krav: forvalgtKrav } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  const { data } = await supabase
    .from("saker")
    .select("id, kreditor, tittel")
    .order("sist_endret", { ascending: false });

  const krav = (data ?? []).map((s) => ({
    id: s.id as string,
    navn: (s.kreditor as string | null) ?? (s.tittel as string),
  }));

  return (
    <LeggTilBrevFlyt krav={krav} forvalgtKrav={forvalgtKrav ?? null} />
  );
}
