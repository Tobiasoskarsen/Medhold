// Gebyrsjekk-panel (designordre §2.1/§3.3). Ved «over»-funn vises full Dom
// øverst; øvrige linjer (innenfor/mulig_over/ukjent) vises som piller under.
// Rekalkulerer ALDRI — viser det lagrede resultatet.
import {
  satserForDato,
  utregningRaderForLinje,
  type GebyrsjekkResultat,
  type Kostnadstype,
  type Vurdering,
} from "@/lib/gebyr";
import { NavLenke as Link } from "@/components/NavLenke";
import { Kort } from "@/components/ui/Kort";
import { Pill } from "@/components/ui/Pill";
import { Dom } from "@/components/Dom";
import { Utregning } from "@/components/Utregning";
import { formaterDato } from "@/lib/dato";

const TYPE_ETIKETT: Record<Kostnadstype, string> = {
  purregebyr: "Purregebyr",
  inkassovarselgebyr: "Inkassovarselgebyr",
  betalingsoppfordringsgebyr: "Betalingsoppfordringsgebyr",
  salaer: "Inkassosalær",
  forsinkelsesrente: "Forsinkelsesrente",
  rettsgebyr: "Rettsgebyr",
  annet: "Annen kostnad",
};

const PILL: Record<
  Vurdering,
  { tekst: string; variant: "noytral" | "varsel" | "suksess" | "feil" }
> = {
  innenfor: { tekst: "Innenfor sats", variant: "suksess" },
  mulig_over: { tekst: "Sjekk denne", variant: "varsel" },
  over: { tekst: "Over maksimalsats", variant: "feil" },
  ukjent: { tekst: "Ikke kontrollert", variant: "noytral" },
};

function kr(belop: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 2 }).format(belop);
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
  const sats = satserForDato(resultat.satsGyldigFra);
  const kildelinje = (
    <p className="mt-2 text-[12px] text-dempet">
      Satser gjeldende fra {formaterDato(resultat.satsGyldigFra)}. Kilde:{" "}
      <a
        href={sats.kilde}
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
              rader={utregningRaderForLinje(l, sats, hovedstol) ?? []}
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
              <h3 className="font-serif text-[17px] font-semibold text-blekk">
                Gebyrsjekk
              </h3>
              <p className="mt-0.5 text-[12px] text-dempet">
                Kontrollert mot offentlige maksimalsatser (fra{" "}
                {formaterDato(resultat.satsGyldigFra)}).
              </p>
            </>
          )}

          <ul className={harOver ? "space-y-3" : "mt-3 space-y-3"}>
            {rest.map((l, i) => {
              const pill = PILL[l.vurdering];
              return (
                <li
                  key={i}
                  className="border-t-[0.5px] border-strek pt-3 first:border-t-0 first:pt-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-blekk">
                      {TYPE_ETIKETT[l.linje.type]}
                      <span className="text-dempet"> · {kr(l.linje.belop)} kr</span>
                    </span>
                    <Pill variant={pill.variant}>{pill.tekst}</Pill>
                  </div>
                  {l.vurdering !== "innenfor" && (
                    <p className="mt-1.5 text-[13px] text-dempet">{l.forklaring}</p>
                  )}
                  {l.vurdering === "mulig_over" && (
                    <Utregning
                      rader={utregningRaderForLinje(l, sats, hovedstol) ?? []}
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

      <p className="mt-3 px-1 text-[11px] leading-relaxed text-dempet">
        Automatisk kontroll — ikke juridisk rådgivning. Satsene følger
        inkassoforskriften.
      </p>
    </div>
  );
}
