"use client";

// Veivalg — delt mellom krav-detalj og legg-til-brev steg 3
// (MEDHOLD_VEIVALG_ARBEIDSORDRE). Erstatter det gamle standpunkt-baserte
// dørvalget (uenig i kravet / kravet er riktig) med et handlingsbasert valg
// («Svar på kravet» / «Finn en måte å betale på») + en valgfri, flyktig
// sjekkliste for den usikre brukeren. Sjekklistesvarene lagres ALDRI og
// sendes ALDRI til utkast-prompten — ren UI-tilstand.
import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";
import { ChevronDown, ChevronRight, MessageSquare, Wallet, Clock3 } from "lucide-react";
import { NavLenke as Link } from "@/components/NavLenke";
import { VARIGHET, EASING } from "@/lib/bevegelse";
import { haptikk } from "@/lib/haptikk";
import { anbefalVei, type VeivalgSvar, type Anbefaling } from "@/lib/veivalg";
import { formaterKr } from "@/lib/format";

export type VeivalgMål =
  | { type: "href"; href: string }
  | { type: "klikk"; onKlikk: () => void; deaktivert?: boolean };

function kr(n: number): string {
  return formaterKr(n);
}

/** Lenke eller knapp, avhengig av målet — kravdetaljen navigerer direkte,
 * steg 3 må lagre brevet før den kan gå videre. */
function MålKnapp({
  mål,
  className,
  style,
  children,
}: {
  mål: VeivalgMål;
  className: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  if (mål.type === "href") {
    return (
      <Link href={mål.href} className={className} style={style}>
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
      style={style}
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
  begrunnelse,
  mål,
}: {
  ikon: ReactNode;
  ikonBg: string;
  tittel: string;
  undertekst: string;
  anbefalt: boolean;
  /** Hvorfor valget anbefales, vist tett på handlingen. */
  begrunnelse?: string;
  mål: VeivalgMål;
}) {
  return (
    <MålKnapp
      mål={mål}
      className="trykk flex min-h-[72px] w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-flate-2/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-aksent"
    >
      <span
        aria-hidden="true" className={`flex size-8 shrink-0 items-center justify-center ${ikonBg}`}
      >
        {ikon}
      </span>
      <span className="min-w-0 flex-1 break-words">
        <span className="radtittel block text-blekk">{tittel}</span>
        <span className="radtekst mt-0.5 block">{undertekst}</span>
        {anbefalt && begrunnelse && (
          <span className="mt-1 block text-meta font-semibold text-aksent-dyp">
            Anbefalt: {begrunnelse}
          </span>
        )}
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
      <p className="text-hjelp font-medium text-blekk">{spørsmål}</p>
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
            className={`trykk flex-1 rounded-kontroll border px-3 py-2.5 text-hjelp font-medium transition ${
              valgt === v.verdi
                ? "border-blekk bg-blekk text-bakgrunn"
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
  sumavvikDifferanse = null,
  svarMål,
  betaleMål,
  ekstra,
  senereMål,
  lagreForst = false,
  lagrer = false,
  lagringUkjent = false,
  className = "",
}: {
  /** Sakens nyeste brev har et lagret gebyrsjekk-funn (`over`). Deterministisk
   * — appen synser aldri (guardrail 2). */
  harGebyrfunn: boolean;
  /** Sum kr over lovlig sats, kun brukt i «betale»-resultatteksten. */
  gebyrDifferanse?: number | null;
  /** Kr i brevet som ikke går opp (sumavvik). Null = ikke noe sumavvik. */
  sumavvikDifferanse?: number | null;
  svarMål: VeivalgMål;
  betaleMål: VeivalgMål;
  /** Ekstra innhold rendret nederst (steg 3s «Bestem senere»-lenke). */
  ekstra?: ReactNode;
  senereMål?: VeivalgMål;
  lagreForst?: boolean;
  lagrer?: boolean;
  lagringUkjent?: boolean;
  className?: string;
}) {
  const [åpen, setÅpen] = useState(false);
  const sjekklisteId = useId();
  const [svar, setSvar] = useState<Partial<VeivalgSvar>>({});

  const komplett =
    svar.bestilt !== undefined &&
    svar.tidligereHandlet !== undefined &&
    svar.belopStemmer !== undefined;
  const anbefaling: Anbefaling | null = komplett
    ? anbefalVei(svar as VeivalgSvar)
    : null;

  const lagringstekst = lagrer
    ? "Venter på bekreftelse av lagringen. Ingenting sendes automatisk."
    : lagringUkjent
      ? "Lagringsresultatet er ukjent. Et nytt forsøk her bruker samme lagringsnøkkel. Ingenting sendes automatisk."
      : "Brevet er ikke lagret ennå. Alle tre valg lagrer brevet, valgte frister og huskelisten først. Ingenting sendes automatisk.";

  return (
    <div className={className}>
      <h2 className={lagreForst ? "sr-only" : "seksjonstittel text-blekk"}>
        Neste steg
      </h2>
      {lagreForst && (
        <p className="mt-1 text-hjelp leading-relaxed text-dempet">{lagringstekst}</p>
      )}

      <div className="mt-3 overflow-hidden rounded-kort border border-kant bg-flate [&>*+*]:border-t [&>*+*]:border-strek" aria-busy={lagrer}>
        <VeivalgKort
          ikon={
            <MessageSquare className="size-[19px] text-aksent" aria-hidden />
          }
          ikonBg="text-aksent"
          tittel="Svar på kravet"
          undertekst={lagreForst ? "Lag et svar du kan lese gjennom, endre og sende selv." : "Lag et utkast du kan redigere."}
          anbefalt={harGebyrfunn || !!sumavvikDifferanse}
          begrunnelse={
            // Gebyrfunnet har forrang i begrunnelsen (Del B.4).
            harGebyrfunn
              ? gebyrDifferanse
                ? `gebyrsjekken fant ${kr(gebyrDifferanse)} kr over maksimalsats.`
                : "gebyrsjekken fant et beløp over maksimalsats."
              : sumavvikDifferanse
                ? `${kr(sumavvikDifferanse)} kr i brevet går ikke opp.`
                : undefined
          }
          mål={svarMål}
        />
        <VeivalgKort
          ikon={<Wallet className="size-[19px] text-aksent" aria-hidden />}
          ikonBg="text-aksent"
          tittel="Finn en betalingsløsning"
          undertekst={lagreForst ? "Se muligheter for avdrag eller å be om mer tid." : "Betaling, utsettelse eller avdrag."}
          anbefalt={false}
          mål={betaleMål}
        />
        {senereMål && <VeivalgKort ikon={<Clock3 className="size-[19px] text-dempet" aria-hidden />} ikonBg="text-dempet" tittel="Bestem senere" undertekst="Lagre brevet og kom tilbake når du vil." anbefalt={false} mål={senereMål} />}
      </div>

      <button
        type="button"
        onClick={() => setÅpen((o) => !o)}
        aria-expanded={åpen}
        aria-controls={sjekklisteId}
        className={`trykk mt-1 flex min-h-11 items-center gap-1 rounded-liten text-hjelp font-medium transition hover:text-blekk ${
          åpen ? "text-blekk" : "text-dempet"
        }`}
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
            id={sjekklisteId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: VARIGHET.rolig, ease: EASING }}
            style={{ overflow: "hidden" }}
          >
            <div className="mt-4 flex flex-col gap-4 rounded-kort border border-kant bg-flate p-4">
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

              {/* Høyde+opasitet-inntreden i stedet for display-toggle
                  (gjenbruker Utvidbar-mekanikken, Motion3 §2.3) — reduced
                  motion følger MotionConfig, som over. */}
              <AnimatePresence initial={false}>
                {anbefaling && (
                  <m.div
                    key="anbefaling"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: VARIGHET.rolig, ease: EASING }}
                    style={{ overflow: "hidden" }}
                  >
                    <div
                      aria-live="polite"
                      className={`rounded-kontroll p-3.5 text-[13.5px] leading-relaxed text-blekk ${
                        anbefaling === "svar" ? "bg-dom-rod-bg" : "bg-trygg/10"
                      }`}
                    >
                      {anbefaling === "svar" ? (
                        <p>
                          Da er det god grunn til å svare på kravet.{" "}
                          {harGebyrfunn
                            ? "Det du har fortalt, sammen med gebyrfunnet, kan du bruke i en innsigelse."
                            : "Det du har fortalt kan du bruke i en innsigelse."}
                        </p>
                      ) : (
                        <p>
                          Da ser kravet ut til å stemme. Det er helt greit — nå
                          handler det om å finne en løsning som passer deg.
                          {harGebyrfunn && gebyrDifferanse
                            ? ` De ${kr(gebyrDifferanse)} kr over maksimalsats kan du fortsatt ta opp.`
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
                          ? "Lag et utkast →"
                          : "Se alternativene →"}
                      </MålKnapp>
                    </div>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {ekstra}
    </div>
  );
}
