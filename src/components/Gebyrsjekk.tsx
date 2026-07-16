// Gebyrsjekk-panel (designordre §2.1/§3.3). Ved «over»-funn vises full Dom
// øverst; øvrige linjer (innenfor/mulig_over/ukjent) vises som piller under.
// Rekalkulerer ALDRI — viser det lagrede resultatet.
import type { GebyrsjekkResultat, Kostnadstype, Vurdering } from "@/lib/gebyr";
import { Kort } from "@/components/ui/Kort";
import { Pill } from "@/components/ui/Pill";
import { Dom } from "@/components/Dom";
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
  className = "",
}: {
  resultat: GebyrsjekkResultat | null;
  /** Lenke til utkastflyten for «Bruk funnet i innsigelsen» (kun brev-detalj). */
  utkastHref?: string;
  className?: string;
}) {
  if (!resultat || resultat.linjer.length === 0) return null;

  const harOver = resultat.linjer.some((l) => l.vurdering === "over");
  const rest = resultat.linjer.filter((l) => l.vurdering !== "over");

  return (
    <div className={className}>
      {harOver && <Dom resultat={resultat} utkastHref={utkastHref} />}

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
