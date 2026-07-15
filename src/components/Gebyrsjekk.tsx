// Gebyrsjekk-panel (MEDHOLD_GEBYRSJEKK_ARBEIDSORDRE §7.1). Rolig, saklig
// visning av den deterministiske gebyrsjekken. Rekalkulerer ALDRI — viser
// resultatet slik det ble beregnet (fra analysen i steg 3 eller lagret jsonb).
//
// Ingen kostnadslinjer → panelet vises ikke i det hele tatt (ingen «alt ser
// bra ut»-melding når vi ikke har noe å vurdere).
import type { GebyrsjekkResultat, Kostnadstype, Vurdering } from "@/lib/gebyr";
import { Kort } from "@/components/ui/Kort";
import { Pill } from "@/components/ui/Pill";
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

/** Norsk beløp med tusenskille, opptil to desimaler. */
function kr(belop: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 2 }).format(belop);
}

export function Gebyrsjekk({
  resultat,
  className = "",
}: {
  resultat: GebyrsjekkResultat | null;
  className?: string;
}) {
  if (!resultat || resultat.linjer.length === 0) return null;

  return (
    <Kort className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-blekk">Gebyrsjekk</h3>
      </div>
      <p className="mt-0.5 text-[12px] text-dempet">
        Kontrollert mot offentlige maksimalsatser (fra{" "}
        {formaterDato(resultat.satsGyldigFra)}).
      </p>

      <ul className="mt-3 space-y-3">
        {resultat.linjer.map((l, i) => {
          const pill = PILL[l.vurdering];
          const visForklaring = l.vurdering !== "innenfor";
          return (
            <li key={i} className="border-t-[0.5px] border-strek pt-3 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-blekk">
                  {TYPE_ETIKETT[l.linje.type]}
                  <span className="text-dempet"> · {kr(l.linje.belop)} kr</span>
                </span>
                <Pill variant={pill.variant}>{pill.tekst}</Pill>
              </div>
              {visForklaring && (
                <p className="mt-1.5 text-[13px] text-dempet">{l.forklaring}</p>
              )}
              {l.vurdering === "over" && l.differanse != null && (
                <p className="mt-1 text-[13px] font-medium text-red-700">
                  {kr(l.differanse)} kr over høyeste lovlige sats
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-[11px] leading-relaxed text-dempet">
        Automatisk kontroll — ikke juridisk rådgivning. Satsene følger
        inkassoforskriften.
      </p>
    </Kort>
  );
}
