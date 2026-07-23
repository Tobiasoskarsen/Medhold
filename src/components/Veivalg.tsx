"use client";

// Veivalg — delt mellom krav-detalj og legg-til-brev steg 3
// (MEDHOLD_VEIVALG_ARBEIDSORDRE). Erstatter det gamle standpunkt-baserte
// dørvalget (uenig i kravet / kravet er riktig) med et handlingsbasert valg
// («Svar på kravet» / «Finn en måte å betale på») + en valgfri, flyktig
// sjekkliste for den usikre brukeren. Sjekklistesvarene lagres ALDRI og
// sendes ALDRI til utkast-prompten — ren UI-tilstand.
import { useState, type ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";
import { ChevronDown, ChevronRight, Check } from "lucide-react";
import { NavLenke as Link } from "@/components/NavLenke";
import { Pill } from "@/components/ui";
import { VARIGHET, EASING } from "@/lib/bevegelse";
import { haptikk } from "@/lib/haptikk";
import { anbefalVei, type VeivalgSvar, type Anbefaling } from "@/lib/veivalg";

export type VeivalgMål =
  | { type: "href"; href: string }
  | { type: "klikk"; onKlikk: () => void; deaktivert?: boolean };

function kr(n: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 2 }).format(n);
}

/** Lenke eller knapp, avhengig av målet — kravdetaljen navigerer direkte,
 * steg 3 må lagre brevet før den kan gå videre. */
function MålKnapp({
  mål,
  className,
  children,
}: {
  mål: VeivalgMål;
  className: string;
  children: ReactNode;
}) {
  if (mål.type === "href") {
    return (
      <Link href={mål.href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={mål.onKlikk}
      disabled={mål.deaktivert}
      className={`${className} disabled:opacity-60`}
    >
      {children}
    </button>
  );
}

function VeivalgKort({
  ikon,
  ikonBg,
  tittel,
  undertekst,
  anbefalt,
  mål,
}: {
  ikon: ReactNode;
  ikonBg: string;
  tittel: string;
  undertekst: string;
  anbefalt: boolean;
  mål: VeivalgMål;
}) {
  return (
    <MålKnapp
      mål={mål}
      className={`trykk relative flex w-full items-center gap-3 rounded-2xl border-[0.5px] bg-flate px-4 py-4 text-left ${
        anbefalt ? "border-aksent" : "border-strek"
      }`}
    >
      {anbefalt && (
        <Pill variant="aksent" className="absolute -top-2 right-3">
          Anbefalt
        </Pill>
      )}
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-full ${ikonBg}`}
      >
        {ikon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-blekk">
          {tittel}
        </span>
        <span className="mt-0.5 block text-[12px] leading-snug text-dempet">
          {undertekst}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-dempet" aria-hidden />
    </MålKnapp>
  );
}

const JA_NEI_VETIKKE = [
  { verdi: "ja", etikett: "Ja" },
  { verdi: "nei", etikett: "Nei" },
  { verdi: "vet_ikke", etikett: "Vet ikke" },
] as const;
const JA_NEI = [
  { verdi: "ja", etikett: "Ja" },
  { verdi: "nei", etikett: "Nei" },
] as const;

function Spørsmålsrad<T extends string>({
  spørsmål,
  valg,
  valgt,
  onVelg,
}: {
  spørsmål: string;
  valg: readonly { verdi: T; etikett: string }[];
  valgt: T | undefined;
  onVelg: (v: T) => void;
}) {
  return (
    <div>
      <p className="text-[13px] font-medium text-blekk">{spørsmål}</p>
      <div className="mt-2 flex gap-2">
        {valg.map((v) => (
          <button
            key={v.verdi}
            type="button"
            onClick={() => {
              haptikk("lett");
              onVelg(v.verdi);
            }}
            aria-pressed={valgt === v.verdi}
            className={`trykk flex-1 rounded-[10px] border-[0.5px] px-3 py-2.5 text-[13px] font-medium transition ${
              valgt === v.verdi
                ? "border-aksent bg-aksent/10 text-aksent-dyp"
                : "border-strek text-blekk hover:border-dempet/40"
            }`}
          >
            {v.etikett}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Veivalg({
  harGebyrfunn,
  gebyrDifferanse = null,
  svarMål,
  betaleMål,
  ekstra,
  className = "",
}: {
  /** Sakens nyeste brev har et lagret gebyrsjekk-funn (`over`). Deterministisk
   * — appen synser aldri (guardrail 2). */
  harGebyrfunn: boolean;
  /** Sum kr over lovlig sats, kun brukt i «betale»-resultatteksten. */
  gebyrDifferanse?: number | null;
  svarMål: VeivalgMål;
  betaleMål: VeivalgMål;
  /** Ekstra innhold rendret nederst (steg 3s «Bestem senere»-lenke). */
  ekstra?: ReactNode;
  className?: string;
}) {
  const [åpen, setÅpen] = useState(false);
  const [svar, setSvar] = useState<Partial<VeivalgSvar>>({});

  const komplett =
    svar.bestilt !== undefined &&
    svar.tidligereHandlet !== undefined &&
    svar.belopStemmer !== undefined;
  const anbefaling: Anbefaling | null = komplett
    ? anbefalVei(svar as VeivalgSvar)
    : null;

  return (
    <div className={className}>
      <h2 className="font-serif text-[19px] font-semibold text-blekk">
        Hva vil du gjøre?
      </h2>
      <p className="mt-1 text-[13px] leading-relaxed text-dempet">
        Du kan ombestemme deg når som helst — ingenting sendes før du sier
        fra.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <VeivalgKort
          ikon={
            <span className="font-serif text-[17px] font-semibold text-dom-rod">
              §
            </span>
          }
          ikonBg="bg-dom-rod-bg"
          tittel="Svar på kravet"
          undertekst={
            harGebyrfunn
              ? "Bruk gebyrfunnet — vi skriver brevet"
              : "Vi skriver brevet — du godkjenner før noe sendes"
          }
          anbefalt={harGebyrfunn}
          mål={svarMål}
        />
        <VeivalgKort
          ikon={<Check className="size-[18px] text-trygg" aria-hidden />}
          ikonBg="bg-trygg/10"
          tittel="Finn en måte å betale på"
          undertekst="Betal alt, utsett, eller foreslå nedbetaling"
          anbefalt={false}
          mål={betaleMål}
        />
      </div>

      <button
        type="button"
        onClick={() => setÅpen((o) => !o)}
        aria-expanded={åpen}
        className="trykk mt-4 flex items-center gap-1 text-[13px] font-medium text-dempet transition hover:text-blekk"
      >
        Usikker? Hjelp meg å velge
        <ChevronDown
          className={`size-[15px] transition-transform duration-200 ${
            åpen ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {/* Reduced motion følger MotionConfig i (app)/legg-til-brev (samme
          mønster som meg/Utvidbar.tsx) — ingen egen gren nødvendig. */}
      <AnimatePresence initial={false}>
        {åpen && (
          <m.div
            key="sjekkliste"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: VARIGHET.rolig, ease: EASING }}
            style={{ overflow: "hidden" }}
          >
            <div className="mt-4 flex flex-col gap-4 rounded-2xl border-[0.5px] border-strek bg-flate p-4">
              <Spørsmålsrad
                spørsmål="Har du bestilt eller avtalt det kravet gjelder?"
                valg={JA_NEI_VETIKKE}
                valgt={svar.bestilt}
                onVelg={(v) => setSvar((s) => ({ ...s, bestilt: v }))}
              />
              <Spørsmålsrad
                spørsmål="Har du sagt opp, betalt, eller klaget på dette tidligere?"
                valg={JA_NEI}
                valgt={svar.tidligereHandlet}
                onVelg={(v) => setSvar((s) => ({ ...s, tidligereHandlet: v }))}
              />
              <Spørsmålsrad
                spørsmål="Stemmer beløpet med det du mener du skylder?"
                valg={JA_NEI_VETIKKE}
                valgt={svar.belopStemmer}
                onVelg={(v) => setSvar((s) => ({ ...s, belopStemmer: v }))}
              />

              {anbefaling && (
                <div
                  aria-live="polite"
                  className={`rounded-xl p-3.5 text-[13.5px] leading-relaxed text-blekk ${
                    anbefaling === "svar" ? "bg-dom-rod-bg" : "bg-trygg/10"
                  }`}
                >
                  {anbefaling === "svar" ? (
                    <p>
                      Da er det god grunn til å svare på kravet.{" "}
                      {harGebyrfunn
                        ? "Det du har fortalt — sammen med gebyrfunnet — er akkurat det et innsigelsesbrev bygges av."
                        : "Det du har fortalt er akkurat det et innsigelsesbrev bygges av."}
                    </p>
                  ) : (
                    <p>
                      Da ser kravet ut til å stemme. Det er helt greit — nå
                      handler det om å finne veien ut som passer deg.
                      {harGebyrfunn && gebyrDifferanse
                        ? ` Salæret på ${kr(gebyrDifferanse)} kr over sats tar vi med uansett.`
                        : ""}
                    </p>
                  )}
                  <MålKnapp
                    mål={anbefaling === "svar" ? svarMål : betaleMål}
                    className={`trykk mt-2 inline-block text-[13.5px] font-semibold underline underline-offset-4 ${
                      anbefaling === "svar" ? "text-dom-rod" : "text-trygg"
                    }`}
                  >
                    {anbefaling === "svar"
                      ? "Start svaret →"
                      : "Se veiene ut →"}
                  </MålKnapp>
                </div>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {ekstra}
    </div>
  );
}
