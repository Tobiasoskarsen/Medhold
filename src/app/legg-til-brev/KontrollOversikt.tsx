import type { ReactNode } from "react";
import { DomMini, DomMiniSum, FunnListe } from "@/components/Dom";
import { KOSTNADSTYPE_ETIKETT, type GebyrsjekkResultat } from "@/lib/gebyr";
import { gebyrsjekkSetning, kr, sumOverTotalTekst, VURDERING_PILL } from "@/lib/gebyrfunn-visning";
import { sumavvikFra, type Sumkontroll } from "@/lib/sumkontroll";

/**
 * Kontrollsteget (Del E.1): funnene øverst, så én setning i vanlig språk og
 * alle linjer med en pill. Beregner eller endrer ingen vurderinger; alt vises
 * fra gebyrsjekken og sumkontrollen brevflyten allerede har regnet ut.
 */
export function KontrollOversikt({ resultat, sumkontroll, children }: {
  resultat: GebyrsjekkResultat | null;
  sumkontroll?: Sumkontroll;
  children: ReactNode;
}) {
  const linjer = resultat?.linjer ?? [];
  const harOver = linjer.some((l) => l.vurdering === "over");
  // Samme regel som for lagrede brev: bare når brevet krever mer enn linjene.
  const sumavvik = sumkontroll ? sumavvikFra({ sumkontroll }) : null;
  const linjeneOverTotal =
    sumkontroll?.status === "avvik" && sumkontroll.total < sumkontroll.sum - 1 ? sumkontroll : null;
  return (
    <section aria-label="Oversikt over gebyrsjekken" className="mt-5">
      {(harOver || sumavvik) && (
        <FunnListe className="mb-4">
          {harOver && resultat && <DomMini resultat={resultat} />}
          {sumavvik && <DomMiniSum avvik={sumavvik} />}
        </FunnListe>
      )}
      <div className="rounded-kort border border-kant bg-flate p-[18px]">
        <h2 className="seksjonstittel text-blekk">Gebyrsjekken</h2>
        <p className="mt-2 text-hjelp text-blekk">
          {linjer.length === 0
            ? "Ingen kostnadslinjer å kontrollere. Det betyr ikke at kravet er vurdert som riktig."
            : gebyrsjekkSetning(linjer)}
        </p>
        {linjeneOverTotal && (
          <p className="mt-2 text-meta text-dempet">
            {sumOverTotalTekst(linjeneOverTotal.sum, linjeneOverTotal.total)}
          </p>
        )}
        {linjer.length > 0 && (
          <ul className="mt-3 divide-y divide-strek">
            {linjer.map((linje, i) => {
              const pill = VURDERING_PILL[linje.vurdering];
              return (
                <li key={i} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 text-hjelp text-blekk">
                      {KOSTNADSTYPE_ETIKETT[linje.linje.type]} · {kr(linje.linje.belop)} kr
                    </span>
                    <span className={`inline-block shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${pill.klasse}`}>
                      {pill.tekst(linje)}
                    </span>
                  </div>
                  {linje.vurdering === "mulig_over" && (
                    <p className="mt-1 text-hjelp text-dempet">{linje.forklaring}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {resultat?.brevdatoAntatt && (
          <p className="mt-3 text-meta text-dempet">Brevet har ingen dato. Vi har brukt satsene som gjelder i dag.</p>
        )}
        {linjer.length > 0 && (
          <details className="mt-3 border-t border-strek pt-2">
            <summary className="min-h-11 cursor-pointer rounded-liten py-3 text-hjelp font-semibold text-aksent focus-visible:outline-2 focus-visible:outline-aksent">Se gebyrdetaljer og kilder</summary>
            {children}
          </details>
        )}
      </div>
    </section>
  );
}
