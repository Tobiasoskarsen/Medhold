import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LeggTilBrevFlyt } from "./LeggTilBrevFlyt";
import type { SakStatus } from "@/lib/types";

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

  const [{ data }, { data: fristData }] = await Promise.all([
    supabase
      .from("saker")
      .select("id, kreditor, tittel, status, sist_endret")
      .order("sist_endret", { ascending: false }),
    // Aktive frister per sak, så brukeren kan si om det nye brevet erstatter dem.
    supabase
      .from("frister")
      .select("id, sak_id, tittel, forfallsdato")
      .eq("fullfort", false)
      .order("forfallsdato", { ascending: true }),
  ]);

  const krav = (data ?? []).map((s) => ({
    id: s.id as string,
    navn: (s.kreditor as string | null) ?? (s.tittel as string),
    venter: s.status === "venter_pa_svar",
    status: s.status as SakStatus,
    // Saken slik den så ut da siden ble lest: lagringen avvises hvis den er endret.
    sistEndret: s.sist_endret as string,
    frister: (fristData ?? [])
      .filter((f) => f.sak_id === s.id)
      .map((f) => ({
        id: f.id as string,
        tittel: f.tittel as string,
        forfallsdato: f.forfallsdato as string,
      })),
  }));

  return (
    <LeggTilBrevFlyt krav={krav} forvalgtKrav={forvalgtKrav ?? null} />
  );
}
