import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Skjermramme, Kort, Primærknapp } from "@/components/ui";
import { formaterKortDato } from "@/lib/dato";
import { formaterBelop } from "@/lib/format";
import { STADIUM_ETIKETT, type Stadium } from "@/lib/gjeld";

type SakRad = {
  id: string;
  kreditor: string | null;
  tittel: string;
  belop_totalt: number | null;
  stadium: Stadium | null;
};

export default async function KravListePage() {
  const supabase = await createClient();

  const [{ data: sakData }, { data: fristData }] = await Promise.all([
    supabase
      .from("saker")
      .select("id, kreditor, tittel, belop_totalt, stadium, sist_endret")
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
      <h1 className="mb-4 text-[21px] font-medium tracking-[-0.3px] text-blekk">
        Krav
      </h1>

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
                <Link href={`/krav/${sak.id}`} className="block">
                  <Kort className="transition hover:border-dempet/40">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm font-medium text-blekk">
                        {sak.kreditor ?? sak.tittel}
                      </span>
                      {belop && (
                        <span className="shrink-0 text-sm font-medium text-blekk">
                          {belop} kr
                        </span>
                      )}
                    </div>
                    {underlinje && (
                      <p className="mt-1 text-xs text-dempet">{underlinje}</p>
                    )}
                  </Kort>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Skjermramme>
  );
}
