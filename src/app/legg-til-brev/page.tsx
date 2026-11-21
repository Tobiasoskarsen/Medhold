import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LeggTilBrevFlyt } from "./LeggTilBrevFlyt";
import type { SakStatus } from "@/lib/types";
import { osloDato } from "@/lib/dato";

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

  const [{ data }, { data: fristData }, { data: brevData }, { data: sendtData }] = await Promise.all([
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
    // Brevdatoene per sak, så brukeren ser før lagring om brevet er nyest.
    supabase.from("brev").select("sak_id, brevdato"),
    // Når et svar sist ble markert som sendt: samme statusregel som lagre_brev.
    supabase.from("utkast").select("sak_id, sendt_at").not("sendt_at", "is", null),
  ]);

  const sistSendt = new Map<string, string>();
  for (const u of sendtData ?? []) {
    const dag = osloDato(u.sendt_at as string);
    const forrige = sistSendt.get(u.sak_id as string);
    if (!forrige || dag > forrige) sistSendt.set(u.sak_id as string, dag);
  }

  const krav = (data ?? []).map((s) => ({
    id: s.id as string,
    navn: (s.kreditor as string | null) ?? (s.tittel as string),
    venter: s.status === "venter_pa_svar",
    status: s.status as SakStatus,
    // Saken slik den så ut da siden ble lest: lagringen avvises hvis den er endret.
    sistEndret: s.sist_endret as string,
    sistSendt: sistSendt.get(s.id as string) ?? null,
    brevdatoer: (brevData ?? [])
      .filter((b) => b.sak_id === s.id)
      .map((b) => (b.brevdato as string | null) ?? null),
    frister: (fristData ?? [])
      .filter((f) => f.sak_id === s.id)
      .map((f) => ({
        id: f.id as string,
        tittel: f.tittel as string,
        forfallsdato: f.forfallsdato as string,
      })),
  }));

  return (
    <LeggTilBrevFlyt
      krav={krav}
      forvalgtKrav={forvalgtKrav ?? null}
    />
  );
}
