import { NavLenke as Link } from "@/components/NavLenke";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Skjermramme, Kort, Primærknapp } from "@/components/ui";
import { KravBrevFaner } from "@/components/KravBrevFaner";
import { Kravkort } from "./Kravkort";
import { formaterKortDato } from "@/lib/dato";
import { formaterBelop } from "@/lib/format";
import { STADIUM_ETIKETT, type Stadium } from "@/lib/gjeld";
import type { SakStatus } from "@/lib/types";

type SakRad = {
  id: string;
  kreditor: string | null;
  tittel: string;
  opprinnelig_kreditor: string | null;
  belop_totalt: number | null;
  stadium: Stadium | null;
  status: SakStatus;
};

export default async function KravListePage() {
  const supabase = await createClient();

  const [{ data: sakData }, { data: fristData }] = await Promise.all([
    supabase
      .from("saker")
      .select(
        "id, kreditor, tittel, opprinnelig_kreditor, belop_totalt, stadium, status, sist_endret",
      )
      .order("sist_endret", { ascending: false }),
    supabase
      .from("frister")
      .select("sak_id, forfallsdato")
      .eq("fullfort", false),
  ]);

  const saker = (sakData ?? []) as (SakRad & { sist_endret: string })[];
  const frister = (fristData ?? []) as { sak_id: string; forfallsdato: string }[];

  // Nærmeste åpne frist per krav.
  const nesteFrist = new Map<string, string>();
  for (const f of frister) {
    const nå = nesteFrist.get(f.sak_id);
    if (!nå || f.forfallsdato < nå) nesteFrist.set(f.sak_id, f.forfallsdato);
  }

  // Sorter på nærmeste frist; krav uten frist havner sist.
  const sortert = [...saker].sort((a, b) => {
    const fa = nesteFrist.get(a.id);
    const fb = nesteFrist.get(b.id);
    if (fa && fb) return fa < fb ? -1 : 1;
    if (fa) return -1;
    if (fb) return 1;
    return 0;
  });

  return (
    <Skjermramme className="pt-6">
      <KravBrevFaner aktiv="krav" />

      <div className="mt-5">
      {sortert.length === 0 ? (
        <Kort>
          <p className="text-[15px] leading-relaxed text-blekk">
            Legg inn ditt første brev, så holder Medhold oversikten.
          </p>
          <div className="mt-4">
            <Primærknapp href="/legg-til-brev">Legg til brev</Primærknapp>
          </div>
        </Kort>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {sortert.map((sak) => {
            const frist = nesteFrist.get(sak.id);
            const belop = formaterBelop(sak.belop_totalt);
            const underlinje = [
              sak.stadium ? STADIUM_ETIKETT[sak.stadium] : null,
              frist ? `neste frist ${formaterKortDato(frist)}` : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={sak.id}>
                <Kravkort
                  id={sak.id}
                  navn={sak.kreditor ?? sak.tittel}
                  delNavn={!sak.opprinnelig_kreditor}
                  belop={belop}
                  underlinje={underlinje}
                  status={sak.status}
                />
              </li>
            );
          })}
        </ul>
      )}
      </div>

      <Link
        href="/krav/ny"
        className="trykk mt-6 flex w-full items-center justify-center gap-2 rounded-[10px] border-[0.5px] border-aksent/40 bg-flate px-3 py-3 text-sm font-medium text-aksent transition hover:bg-aksent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aksent"
      >
        <Plus className="size-4" aria-hidden />
        Opprett nytt krav
      </Link>
    </Skjermramme>
  );
}
