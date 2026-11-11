// Gebyrsjekk-panel (designordre §2.1/§3.3). Ved «over»-funn vises full Dom
// øverst; øvrige linjer (innenfor/mulig_over/ukjent) vises som piller under.
// Rekalkulerer ALDRI — viser det lagrede resultatet.
import {
  KOSTNADSTYPE_ETIKETT,
  satserForDato,
  SATSVERSJONER,
  utregningRaderForLinje,
  type GebyrsjekkResultat,
} from "@/lib/gebyr";
import { NavLenke as Link } from "@/components/NavLenke";
import { Kort } from "@/components/ui/Kort";
import { Dom } from "@/components/Dom";
import { Utregning } from "@/components/Utregning";
import { formaterDato } from "@/lib/dato";
import { formaterKr } from "@/lib/format";
import { VURDERING_PILL } from "@/lib/gebyrfunn-visning";

function kr(belop: number): string {
  return formaterKr(belop);
}

export function Gebyrsjekk({
  resultat,
  utkastHref,
  /** Hovedstol (salærgrunnlaget) — kun kjent i legg-til-brev steg 3, før
   *  lagring. Lagrede brev har den ikke (ingen egen kolonne, jf. guardrail 4
   *  — se PROSJEKT_STATUS «Valg tatt underveis»), så Hovedstol/Salærtrinn-
   *  radene i utregningen utelates da (utregningRaderForLinje håndterer det). */
  hovedstol = null,
  className = "",
}: {
  resultat: GebyrsjekkResultat | null;
  /** Lenke til utkastflyten for «Bruk funnet i innsigelsen» (kun brev-detalj). */
  utkastHref?: string;
  hovedstol?: number | null;
  className?: string;
}) {
  if (!resultat || resultat.linjer.length === 0) return null;

  const harOver = resultat.linjer.some((l) => l.vurdering === "over");
  const overLinjer = resultat.linjer.filter((l) => l.vurdering === "over");
  const rest = resultat.linjer.filter((l) => l.vurdering !== "over");
  // Versjonen resultatet ble vurdert mot (satsGyldigFra er dens startdato).
  // Kun null hvis versjonen er fjernet — da finnes ingen over/mulig_over-
  // linjer som trenger utregningen.
  const sats = satserForDato(resultat.satsGyldigFra);
  const kildelinje = (
    <p className="mt-2 text-meta text-dempet">
      Satser gjeldende fra {formaterDato(resultat.satsGyldigFra)}. Kilde:{" "}
      <a
        href={sats?.kilde ?? SATSVERSJONER[0].kilde}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-strek underline-offset-2 hover:decoration-aksent"
      >
        Finanstilsynet
      </a>
      .{" "}
      <Link
        href="/satser"
        className="underline decoration-strek underline-offset-2 hover:decoration-aksent"
      >
        Se satsene vi bruker
      </Link>
      .
    </p>
  );

  return (
    <div className={className}>
      {harOver && (
        <>
          <Dom resultat={resultat} utkastHref={utkastHref} />
          {overLinjer.map((l, i) => (
            <Utregning
              key={i}
              rader={(sats && utregningRaderForLinje(l, sats, hovedstol)) || []}
              uthevetFarge="dom-rod"
              kildelinje={kildelinje}
              className="mt-3"
            />
          ))}
        </>
      )}

      {rest.length > 0 && (
        <Kort className={harOver ? "mt-3" : ""}>
          {!harOver && (
            <>
              <h3 className="seksjonstittel text-blekk">
                Gebyrsjekk
              </h3>
              <p className="mt-0.5 text-meta text-dempet">
                {resultat.satserMangler ? (
                  "Ikke kontrollert. Satsene for brevets dato er ikke lagt inn."
                ) : (
                  <>
                    Kontrollert mot offentlige maksimalsatser (fra{" "}
                    {formaterDato(resultat.satsGyldigFra)}).
                  </>
                )}
              </p>
            </>
          )}

          <ul className={harOver ? "space-y-3" : "mt-3 space-y-3"}>
            {rest.map((l, i) => {
              const pill = VURDERING_PILL[l.vurdering];
              return (
                <li
                  key={i}
                  className="border-t-[0.5px] border-strek pt-3 first:border-t-0 first:pt-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-blekk">
                      {KOSTNADSTYPE_ETIKETT[l.linje.type]}
                      <span className="text-dempet"> · {kr(l.linje.belop)} kr</span>
                    </span>
                    <span className={`inline-block shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${pill.klasse}`}>
                      {pill.tekst(l)}
                    </span>
                  </div>
                  {l.vurdering !== "innenfor" && (
                    <p className="mt-1.5 text-hjelp text-dempet">{l.forklaring}</p>
                  )}
                  {l.vurdering === "mulig_over" && (
                    <Utregning
                      rader={(sats && utregningRaderForLinje(l, sats, hovedstol)) || []}
                      uthevetFarge="noytral"
                      kildelinje={kildelinje}
                      className="mt-2"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </Kort>
      )}

      {resultat.brevdatoAntatt && (
        <p className="mt-3 px-1 text-[11.5px] text-dempet">
          Brevet har ingen dato. Vi har brukt satsene som gjelder i dag.
        </p>
      )}
      <p className="mt-3 px-1 text-[11px] leading-relaxed text-dempet">
        Automatisk beløpskontroll — ikke juridisk rådgivning. Vi har ikke
        kontrollert om disse kostnadene kan kreves samlet.
      </p>
    </div>
  );
}
