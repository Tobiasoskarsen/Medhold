import type { ReactNode } from "react";
import { KOSTNADSTYPE_ETIKETT, type GebyrsjekkResultat } from "@/lib/gebyr";
import { kr } from "@/lib/gebyrfunn-visning";

const ETIKETT = {
  innenfor: "Innenfor beløpsgrensen",
  over: "Over maksimalsats",
  mulig_over: "Må vurderes nærmere",
  ukjent: "Ikke kontrollert",
};

/** Oppsummerer resultatet; beregner eller endrer ingen vurderinger. */
export function KontrollOversikt({ resultat, children }: {
  resultat: GebyrsjekkResultat | null; children: ReactNode;
}) {
  const linjer = resultat?.linjer ?? [];
  const innenfor = linjer.filter(l => l.vurdering === "innenfor").length;
  const kontrollerte = linjer.filter(l => l.vurdering !== "ukjent").length;
  const merknader = linjer.filter(l => l.vurdering !== "innenfor");
  return (
    <section aria-label="Oversikt over beløpskontrollen" className="mt-5 rounded-kort border border-kant bg-flate p-[18px]">
      <h2 className="seksjonstittel text-blekk">Beløpskontrollen kort fortalt</h2>
      <p className="mt-2 text-hjelp text-dempet">
        {linjer.length === 0 ? "Ingen kostnadslinjer å kontrollere. Det betyr ikke at kravet er vurdert som riktig." :
          `${linjer.length} kostnadslinje${linjer.length === 1 ? "" : "r"} · ${innenfor} innenfor beløpsgrensen · ${merknader.length} med merknad`}
      </p>
      {linjer.length > 0 && <p className="mt-2 text-meta text-dempet">{kontrollerte === 0 ? "Ingen kostnadslinjer kunne kontrolleres mot støttede beløpsgrenser." : `${kontrollerte} av ${linjer.length} kostnadslinjer kontrollert mot kjente beløpsgrenser.`}{merknader.length === 0 ? " Ingen merknader i den støttede beløpskontrollen." : ""}</p>}
      {merknader.length > 0 && <ul className="mt-3 divide-y divide-strek">
        {merknader.map((linje, i) => (
          <li key={i} className="py-3 first:pt-0">
            <p className="text-hjelp font-semibold text-blekk">{KOSTNADSTYPE_ETIKETT[linje.linje.type]} · {kr(linje.linje.belop)} kr</p>
            <p className={`mt-0.5 text-meta font-semibold ${linje.vurdering === "over" ? "text-dom-rod" : "text-dempet"}`}>{ETIKETT[linje.vurdering]}</p>
            {linje.vurdering === "over" && linje.differanse !== null && <p className="mt-1 text-hjelp font-semibold text-dom-rod">{kr(linje.differanse)} kr over maksimalsats</p>}
            <p className="mt-1 text-hjelp text-dempet">{linje.forklaring}</p>
          </li>
        ))}
      </ul>}
      {resultat?.brevdatoAntatt && <p className="mt-3 text-meta text-dempet">Brevet har ingen dato. Vi har brukt satsene som gjelder i dag.</p>}
      <p className="mt-3 text-meta text-dempet">Vi har ikke kontrollert om kostnadene kan kreves samlet. Beløpskontrollen avgjør ikke om kravet er gyldig.</p>
      {linjer.length > 0 && <details className="mt-3 border-t border-strek pt-2">
        <summary className="min-h-11 cursor-pointer rounded-liten py-3 text-hjelp font-semibold text-aksent focus-visible:outline-2 focus-visible:outline-aksent">Se gebyrdetaljer og kilder</summary>
        {children}
      </details>}
    </section>
  );
}
