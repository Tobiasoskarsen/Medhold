"use client";

import { useMemo, useRef, useState } from "react";
import { Avkrysning } from "@/components/ui/Avkrysning";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { X, Camera, Upload, Type, Trash2 } from "lucide-react";
import { Primærknapp } from "@/components/ui";
import { Bevegelsesramme } from "@/components/Bevegelsesramme";
import { VARIGHET, EASING, FJAER, STEG_GLID } from "@/lib/bevegelse";
import { haptikk } from "@/lib/haptikk";
import {
  BREVTYPER,
  STADIUM_ETIKETT,
  LOVBESTEMT_FRIST_DAGER,
  beregnFrist,
  type BrevType,
} from "@/lib/gjeld";
import { formaterKortDato, formaterDato } from "@/lib/dato";
import { sammenlignFrist, type FristSammenligning } from "@/lib/frist";
import {
  UTFALL_VALGBARE,
  UTFALL_ETIKETT,
  type FristForslag,
  type FristKilde,
  type SakUtfall,
} from "@/lib/types";
import { svarUtfallTilSak } from "@/lib/utfall";
import { tolkKr } from "@/lib/format";
import { FORKLARING_DISCLAIMER } from "@/lib/brand";
import { Gebyrsjekk } from "@/components/Gebyrsjekk";
import { Veivalg } from "@/components/Veivalg";
import { LeserBrev } from "./LeserBrev";
import { Bekreftelse } from "./Bekreftelse";
import { sjekkKostnader, type Kostnadslinje } from "@/lib/gebyr";
import { kontrollerSum } from "@/lib/sumkontroll";
import {
  analyserBrevTekst,
  analyserBrevBilder,
  lagreBrev,
  type AnalyseResultat,
  type LagreBrevInput,
  type KravForslag,
} from "./actions";
import type { Bilde } from "@/lib/brevanalyse";

type AnalyseData = Extract<AnalyseResultat, { ok: true }>["analyse"];
type KravValg = { id: string; navn: string; venter: boolean };
type Inntak = "valg" | "tekst" | "bilde";
type ValgtBilde = Bilde & { navn: string };

function brevtypeEtikett(bt: BrevType): string {
  return bt === "annet" ? "Annet" : STADIUM_ETIKETT[bt];
}

// Stegbytte glir i retningen brukeren går (frem: fra høyre, tilbake: fra
// venstre). MotionConfig gjør det om til ren fade ved redusert bevegelse.
const STEG_OVERGANG = {
  inn: (r: 1 | -1) => ({ opacity: 0, x: r * STEG_GLID }),
  synlig: { opacity: 1, x: 0 },
  ut: (r: 1 | -1) => ({ opacity: 0, x: -r * STEG_GLID }),
};

const STEG_NAVN = ["Brevet", "Lesing", "Sjekk"] as const;

/**
 * Tre tynne segmenter for stegene i flyten. Fyllingen vokser inn fra venstre
 * med fjær når et steg nås, og trekker seg tilbake hvis du går tilbake.
 */
function StegIndikator({ steg }: { steg: 1 | 2 | 3 }) {
  return (
    <div
      className="flex w-28 gap-1"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={3}
      aria-valuenow={steg}
      aria-valuetext={`Steg ${steg} av 3: ${STEG_NAVN[steg - 1]}`}
    >
      {[1, 2, 3].map((n) => (
        <span key={n} className="h-1 flex-1 overflow-hidden rounded-full bg-flate-2">
          <m.span
            className="block h-full origin-left rounded-full bg-aksent"
            initial={false}
            animate={{ scaleX: n <= steg ? 1 : 0 }}
            transition={FJAER}
          />
        </span>
      ))}
    </div>
  );
}

function lesFilSomBase64(fil: File): Promise<ValgtBilde> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve({
        media_type: fil.type,
        data: s.slice(s.indexOf(",") + 1),
        navn: fil.name,
      });
    };
    r.onerror = () => reject(new Error("lesefeil"));
    r.readAsDataURL(fil);
  });
}

export function LeggTilBrevFlyt({
  krav,
  forvalgtKrav,
}: {
  krav: KravValg[];
  forvalgtKrav: string | null;
}) {
  const router = useRouter();
  const [steg, setSteg] = useState<1 | 2 | 3>(1);
  // +1 frem, -1 tilbake (feil under lesing sender deg tilbake til steg 1).
  const [retning, setRetning] = useState<1 | -1>(1);
  // Ref, ikke state: gaTil kalles også etter await (lesTekst/lesBilder), der
  // `steg` fra closuren ville vært utdatert.
  const stegRef = useRef<1 | 2 | 3>(1);
  function gaTil(neste: 1 | 2 | 3) {
    setRetning(neste >= stegRef.current ? 1 : -1);
    stegRef.current = neste;
    setSteg(neste);
  }
  const [inntak, setInntak] = useState<Inntak>("valg");
  const [tekst, setTekst] = useState("");
  const [bilder, setBilder] = useState<ValgtBilde[]>([]);
  const [feil, setFeil] = useState<string | null>(null);
  const [lagrer, setLagrer] = useState(false);
  const kameraInput = useRef<HTMLInputElement | null>(null);
  const filInput = useRef<HTMLInputElement | null>(null);

  const [analyse, setAnalyse] = useState<AnalyseData | null>(null);
  const [originalTekst, setOriginalTekst] = useState("");
  const [avsender, setAvsender] = useState("");
  const [avsenderEpost, setAvsenderEpost] = useState("");
  const [brevtype, setBrevtype] = useState<BrevType | "">("");
  const [brevdato, setBrevdato] = useState("");
  const [belop, setBelop] = useState("");
  const [saksnummer, setSaksnummer] = useState("");
  // Standard er «nytt krav» — aldri stille sammenslåing. Kun når brukeren kom
  // hit fra et bestemt krav (forvalgtKrav) er «eksisterende» forhåndsvalgt.
  const [kravModus, setKravModus] = useState<"ny" | "eksisterende">(
    forvalgtKrav ? "eksisterende" : "ny",
  );
  const [valgtKrav, setValgtKrav] = useState<string>(
    forvalgtKrav ?? krav[0]?.id ?? "",
  );
  const [kravForslag, setKravForslag] = useState<KravForslag | null>(null);
  const [fristForslag, setFristForslag] = useState<FristForslag[]>([]);
  const [fristAv, setFristAv] = useState<Record<number, boolean>>({});
  // Den ENE eksplisitte fristen som sammenlignes mot lovberegningen (§A.2) —
  // redigerbar i bekreftelseskortet («Frist i brevet»).
  const [relevantEksplisitt, setRelevantEksplisitt] = useState<{
    tittel: string;
    forfallsdato: string;
  } | null>(null);
  const [fristSammenligningAv, setFristSammenligningAv] = useState(false);
  const [alvorlig, setAlvorlig] = useState(false);
  const [stegAv, setStegAv] = useState<Record<number, boolean>>({});
  const [utfall, setUtfall] = useState<SakUtfall | "">("");
  // Bekreftelseskortet (MEDHOLD_SIKKERHET_ARBEIDSORDRE §A.2): redigerbare
  // kopier av det AI-en leste. Alt under beregnes fra disse, ikke fra analyse.
  const [hovedstolTekst, setHovedstolTekst] = useState("");
  const [linjer, setLinjer] = useState<Kostnadslinje[]>([]);
  const [bekreftet, setBekreftet] = useState(false);
  const [stemmerLikevel, setStemmerLikevel] = useState(false);

  // Linjer uten beløp (en nylig lagt til, ikke utfylt «+ Legg til gebyr») teller ikke.
  const gyldigeLinjer = useMemo(() => linjer.filter((l) => l.belop > 0), [linjer]);

  // Salærgrunnlaget er hovedstol når den finnes, ellers totalbeløpet — delt
  // mellom gebyrsjekk-beregningen og utregningsvisningen (Utregning), slik at
  // «Hovedstol i brevet»-raden alltid stemmer med det som faktisk ble lagt
  // til grunn.
  const hovedstolGrunnlag = useMemo(
    () => tolkKr(hovedstolTekst) ?? tolkKr(belop),
    [hovedstolTekst, belop],
  );

  // Gebyrsjekken beregnes reaktivt fra de bekreftede verdiene — retter du et
  // beløp i bekreftelseskortet, følger panelet med.
  const gebyrsjekk = useMemo(() => {
    if (gyldigeLinjer.length === 0) return null;
    return sjekkKostnader(gyldigeLinjer, hovedstolGrunnlag, brevdato || null);
  }, [gyldigeLinjer, hovedstolGrunnlag, brevdato]);

  const sumkontroll = useMemo(
    () => kontrollerSum(tolkKr(belop), tolkKr(hovedstolTekst), gyldigeLinjer),
    [belop, hovedstolTekst, gyldigeLinjer],
  );
  // Lagring (og visning av funnene) krever bekreftelse — og ved sumavvik i
  // tillegg «Det stemmer likevel». lagreBrev håndhever det samme på serveren.
  const kanLagre =
    bekreftet && (sumkontroll.status !== "avvik" || stemmerLikevel);

  // Fristfunnet regnes på nytt fra den bekreftede datoen (§A.4): retter
  // brukeren brevdatoen, brevtypen eller fristen, følger funnet med.
  const fristSammenligning = useMemo<FristSammenligning | null>(() => {
    const beregnet = brevtype && brevdato ? beregnFrist(brevtype, brevdato) : null;
    return sammenlignFrist(
      relevantEksplisitt,
      beregnet ? { tittel: beregnet.tittel, forfallsdato: beregnet.forfallsdato } : null,
    );
  }, [brevtype, brevdato, relevantEksplisitt]);

  // Hver retting i bekreftelseskortet nullstiller bekreftelsen — det som ble
  // bekreftet, var tallene slik de sto da.
  function rettet<T>(sett: (v: T) => void) {
    return (v: T) => {
      sett(v);
      setBekreftet(false);
      setStemmerLikevel(false);
    };
  }

  // Sum kr over lovlig sats — kun brukt i Veivalgs «betale»-resultattekst.
  const gebyrDifferanse = useMemo(
    () =>
      (gebyrsjekk?.linjer ?? [])
        .filter((l) => l.vurdering === "over")
        .reduce((sum, l) => sum + (l.differanse ?? 0), 0),
    [gebyrsjekk],
  );

  // Utfallsraden vises kun når svaret matches mot en sak i «venter på svar».
  const valgtKravVenter =
    kravModus === "eksisterende" &&
    krav.find((k) => k.id === valgtKrav)?.venter === true;

  function anvendAnalyse(r: Extract<AnalyseResultat, { ok: true }>) {
    setAnalyse(r.analyse);
    setOriginalTekst(r.original_tekst);
    setAvsender(r.analyse.avsender);
    setAvsenderEpost(r.analyse.avsender_epost);
    setBrevtype(r.analyse.brevtype);
    setBrevdato(r.analyse.brevdato);
    setBelop(r.analyse.belop);
    setHovedstolTekst(r.analyse.hovedstol);
    setLinjer(r.analyse.kostnadslinjer);
    setBekreftet(false);
    setStemmerLikevel(false);
    setSaksnummer(r.analyse.saksnummer);
    // Forslag om eksisterende krav — aldri auto-valgt. Vises kun når vi ikke
    // allerede er på et bestemt krav (forvalgtKrav). Brukeren bekrefter selv.
    setKravForslag(forvalgtKrav ? null : r.kravForslag);
    setAlvorlig(r.alvorlig);

    const eksplisitte: FristForslag[] = r.analyse.foreslatte_frister.map((f) => ({
      ...f,
      kilde: "brev_eksplisitt" as const,
    }));
    // Den ENE eksplisitte fristen som er «samme frist» som lovberegningen —
    // første med en konkret dato (§A.2). Andre eksplisitte frister (annen
    // tittel) vises urørt som før.
    const relevantIndeks = eksplisitte.findIndex((f) => f.forfallsdato);
    const relevant = relevantIndeks >= 0 ? eksplisitte[relevantIndeks] : null;
    const andreEksplisitte = eksplisitte.filter((_, i) => i !== relevantIndeks);

    setRelevantEksplisitt(
      relevant ? { tittel: relevant.tittel, forfallsdato: relevant.forfallsdato } : null,
    );
    // Fristen er forhåndsvalgt når det finnes en; sammenligningen selv er
    // reaktiv (useMemo over).
    setFristSammenligningAv(true);

    setFristForslag(andreEksplisitte);
    setFristAv(
      Object.fromEntries(andreEksplisitte.map((f, i) => [i, !!f.forfallsdato])),
    );
    // Forhåndsvalgt utfall fra AI (null ved «uklart» → ingen forhåndsvalg).
    setUtfall(svarUtfallTilSak(r.analyse.svar_utfall) ?? "");
    gaTil(3);
  }

  // samstemmer/kun_beregnet → dato er (også) lovens; avvik_kortere/
  // avvik_lengre/kun_eksplisitt → dato er hentet fra selve brevet.
  function fristSammenligningKilde(status: FristSammenligning["status"]): FristKilde {
    return status === "samstemmer" || status === "kun_beregnet"
      ? "beregnet"
      : "brev_eksplisitt";
  }

  // Kaster selve server action-kallet (krasj på serveren, tidsavbrudd,
  // nettverksfeil), får brukeren en feilmelding og kommer tilbake til steg 1
  // — i stedet for å bli stående i lesingen for alltid.
  async function les(kall: () => Promise<AnalyseResultat>) {
    setFeil(null);
    gaTil(2);
    let r: AnalyseResultat;
    try {
      r = await kall();
    } catch (e) {
      console.error("[legg-til-brev] Lesingen feilet:", e);
      r = { ok: false, feil: "Noe gikk galt under lesingen. Prøv igjen om litt." };
    }
    if (!r.ok) {
      setFeil(r.feil);
      gaTil(1);
      return;
    }
    anvendAnalyse(r);
  }

  function lesTekst() {
    return les(() => analyserBrevTekst(tekst));
  }

  function lesBilder() {
    return les(() =>
      analyserBrevBilder(bilder.map(({ media_type, data }) => ({ media_type, data }))),
    );
  }

  async function velgFiler(filer: FileList | null) {
    if (!filer) return;
    setFeil(null);
    const nye: ValgtBilde[] = [];
    for (const f of Array.from(filer).slice(0, 2 - bilder.length)) {
      try {
        nye.push(await lesFilSomBase64(f));
      } catch {
        setFeil("Kunne ikke lese fila. Prøv en annen.");
      }
    }
    setBilder((b) => [...b, ...nye].slice(0, 2));
    setInntak("bilde");
  }

  async function lagre(destinasjon: "innsigelse" | "veier-ut" | "krav") {
    if (!analyse || !kanLagre) return;
    setLagrer(true);
    setFeil(null);

    const andreValgte = fristForslag.filter((f, i) => f.forfallsdato && fristAv[i]);
    const sammenligningValgt: FristForslag[] =
      fristSammenligning && fristSammenligningAv
        ? [
            {
              tittel: fristSammenligning.visTittel,
              forfallsdato: fristSammenligning.visForfallsdato,
              kilde: fristSammenligningKilde(fristSammenligning.status),
            },
          ]
        : [];
    const valgteFrister = [...sammenligningValgt, ...andreValgte];
    const valgteSteg = analyse.foreslatte_steg.filter((_, i) => stegAv[i] !== false);

    const input: LagreBrevInput = {
      krav:
        kravModus === "eksisterende" && valgtKrav
          ? { modus: "eksisterende", sakId: valgtKrav }
          : { modus: "ny", kreditor: avsender },
      avsender,
      avsender_epost: avsenderEpost,
      brevtype: brevtype || null,
      brevdato,
      belop: tolkKr(belop),
      saksnummer,
      original_tekst: originalTekst,
      forklaring: analyse.forklaring,
      foreslatte_steg: valgteSteg,
      valgteFrister,
      utfall: valgtKravVenter && utfall ? utfall : null,
      kostnadslinjer: gyldigeLinjer,
      hovedstol: tolkKr(hovedstolTekst),
      fristfunn: fristSammenligning,
      alvorlig,
      bekreftet: true,
      sumStemmerLikevel: stemmerLikevel,
    };

    const r = await lagreBrev(input);
    if (!r.ok) {
      setFeil(r.feil);
      setLagrer(false);
      return;
    }
    haptikk("suksess");
    // Medhold utløser løst-seremonien på krav-detaljen.
    if (valgtKravVenter && utfall === "medhold") {
      try {
        sessionStorage.setItem(`medhold-lost-nettopp-${r.sakId}`, "1");
      } catch {
        /* ignorer */
      }
    }
    const mål =
      destinasjon === "innsigelse"
        ? `/krav/${r.sakId}/utkast?type=innsigelse`
        : destinasjon === "veier-ut"
          ? `/krav/${r.sakId}/veier-ut`
          : `/krav/${r.sakId}`;
    router.push(mål);
    router.refresh();
  }

  const feltKlasse =
    "mt-1.5 w-full rounded-kontroll border border-strek bg-flate px-3.5 py-2.5 text-sm text-blekk outline-none focus:border-aksent focus-visible:ring-2 focus-visible:ring-aksent/30";

  return (
    <Bevegelsesramme>
    <m.main
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: VARIGHET.rolig, ease: EASING }}
      className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col px-5 pt-4">
      <div className="mb-4 flex items-center justify-between gap-4">
        <button
          type="button"
          aria-label="Avbryt"
          onClick={() => (inntak !== "valg" && steg === 1 ? setInntak("valg") : router.back())}
          className="trykk -ml-1 flex size-8 items-center justify-center text-dempet transition hover:text-blekk"
        >
          <X className="size-5" aria-hidden />
        </button>
        <StegIndikator steg={steg} />
      </div>

      {/* Skjulte filvelgere. */}
      <input
        ref={kameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => velgFiler(e.target.files)}
      />
      <input
        ref={filInput}
        type="file"
        accept="image/*,application/pdf"
        multiple
        hidden
        onChange={(e) => velgFiler(e.target.files)}
      />

      <AnimatePresence mode="wait" custom={retning}>
      {steg === 1 && (
        <m.div
          key="steg-1"
          custom={retning}
          variants={STEG_OVERGANG}
          initial="inn"
          animate="synlig"
          exit="ut"
          transition={{ duration: VARIGHET.rolig, ease: EASING }}
          className="flex flex-1 flex-col">
          <h1 className="tittel-s text-blekk">
            Legg til brev
          </h1>

          {inntak === "valg" && (
            <>
              <p className="mt-1.5 text-hjelp leading-relaxed text-dempet">
                Velg hvordan du vil legge inn brevet.
              </p>
              <div className="mt-5 flex flex-col gap-2.5">
                <InntakKort
                  ikon={<Camera className="size-5" aria-hidden />}
                  tittel="Ta bilde"
                  tekst="Fotografer brevet med kameraet"
                  onClick={() => kameraInput.current?.click()}
                />
                <InntakKort
                  ikon={<Upload className="size-5" aria-hidden />}
                  tittel="Last opp fil"
                  tekst="Bilde eller PDF fra enheten"
                  onClick={() => filInput.current?.click()}
                />
                <InntakKort
                  ikon={<Type className="size-5" aria-hidden />}
                  tittel="Lim inn tekst"
                  tekst="Skriv eller lim inn teksten selv"
                  onClick={() => setInntak("tekst")}
                />
              </div>
              {feil && <p className="mt-4 text-hjelp text-dom-rod">{feil}</p>}
            </>
          )}

          {inntak === "tekst" && (
            <>
              <p className="mt-1.5 text-hjelp leading-relaxed text-dempet">
                Lim inn teksten fra brevet, så leser Medhold det.
              </p>
              <textarea
                value={tekst}
                onChange={(e) => setTekst(e.target.value)}
                rows={12}
                placeholder="Lim inn teksten fra brevet her …"
                className="mt-4 w-full flex-1 resize-none rounded-kontroll border border-strek bg-flate p-4 text-sm leading-relaxed text-blekk outline-none focus:border-aksent focus-visible:ring-2 focus-visible:ring-aksent/30"
              />
              {feil && <p className="mt-3 text-hjelp text-dom-rod">{feil}</p>}
              <div className="mt-4 pb-8">
                <Primærknapp onClick={lesTekst} disabled={tekst.trim().length < 10}>
                  Les brevet
                </Primærknapp>
              </div>
            </>
          )}

          {inntak === "bilde" && (
            <>
              <p className="mt-1.5 text-hjelp leading-relaxed text-dempet">
                {bilder.length}/2 bilder. Legg gjerne til baksiden også.
              </p>
              <div className="mt-4 flex flex-col gap-2.5">
                {bilder.map((b, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-xl border-[0.5px] border-strek bg-flate px-3.5 py-3"
                  >
                    <span className="truncate text-sm text-blekk">{b.navn}</span>
                    <button
                      type="button"
                      aria-label="Fjern"
                      onClick={() =>
                        setBilder((prev) => prev.filter((_, n) => n !== i))
                      }
                      className="text-dempet transition hover:text-dom-rod"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                ))}
                {bilder.length < 2 && (
                  <button
                    type="button"
                    onClick={() => filInput.current?.click()}
                    className="rounded-xl border-[0.5px] border-dashed border-strek px-3.5 py-3 text-sm text-dempet transition hover:border-aksent hover:text-blekk"
                  >
                    + Legg til bilde
                  </button>
                )}
              </div>
              {feil && <p className="mt-3 text-hjelp text-dom-rod">{feil}</p>}
              <div className="mt-4 pb-8">
                <Primærknapp onClick={lesBilder} disabled={bilder.length === 0}>
                  Les brevet
                </Primærknapp>
              </div>
            </>
          )}
        </m.div>
      )}

      {steg === 2 && (
        <m.div
          key="steg-2"
          custom={retning}
          variants={STEG_OVERGANG}
          initial="inn"
          animate="synlig"
          exit="ut"
          transition={{ duration: VARIGHET.rolig, ease: EASING }}
          className="flex flex-1 flex-col"
        >
          <LeserBrev
            bilde={
              bilder[0] && bilder[0].media_type.startsWith("image/")
                ? `data:${bilder[0].media_type};base64,${bilder[0].data}`
                : null
            }
            tekst={inntak === "tekst" ? tekst : null}
          />
        </m.div>
      )}

      {steg === 3 && analyse && (
        <m.div
          key="steg-3"
          custom={retning}
          variants={STEG_OVERGANG}
          initial="inn"
          animate="synlig"
          exit="ut"
          transition={{ duration: VARIGHET.rolig, ease: EASING }}
          className="flex flex-1 flex-col pb-8"
        >
          <h1 className="tittel-s text-blekk">
            Slik forstår vi brevet
          </h1>

          <Bekreftelse
            brevdato={brevdato}
            onBrevdato={rettet(setBrevdato)}
            belop={belop}
            onBelop={rettet(setBelop)}
            hovedstolTekst={hovedstolTekst}
            onHovedstol={rettet(setHovedstolTekst)}
            linjer={linjer}
            onLinjer={rettet(setLinjer)}
            fristIBrevet={relevantEksplisitt?.forfallsdato ?? ""}
            onFristIBrevet={rettet((v: string) =>
              setRelevantEksplisitt((f) =>
                v ? { tittel: f?.tittel || "Betalingsfrist", forfallsdato: v } : null,
              ),
            )}
            sumkontroll={sumkontroll}
            bekreftet={bekreftet}
            onBekreftet={setBekreftet}
            stemmerLikevel={stemmerLikevel}
            onStemmerLikevel={setStemmerLikevel}
          />

          <div className="mt-4 rounded-2xl border-[0.5px] border-strek bg-flate p-4">
            <p className="whitespace-pre-line text-sm leading-relaxed text-blekk">
              {analyse.forklaring}
            </p>
          </div>
          <p className="mt-1.5 text-meta text-dempet">
            {FORKLARING_DISCLAIMER}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <label className="col-span-2 block text-hjelp font-medium text-blekk">
              Avsender
              <input
                type="text"
                value={avsender}
                onChange={(e) => setAvsender(e.target.value)}
                placeholder="F.eks. Kredinor"
                className={feltKlasse}
              />
            </label>
            <label className="col-span-2 block text-hjelp font-medium text-blekk">
              E-post til avsender
              <input
                type="email"
                inputMode="email"
                value={avsenderEpost}
                onChange={(e) => setAvsenderEpost(e.target.value)}
                placeholder="Slik den står i brevet — valgfritt"
                className={feltKlasse}
              />
            </label>
            <label className="block text-hjelp font-medium text-blekk">
              Brevtype
              <select
                value={brevtype}
                onChange={(e) => setBrevtype(e.target.value as BrevType | "")}
                className={feltKlasse}
              >
                <option value="">Velg …</option>
                {BREVTYPER.map((bt) => (
                  <option key={bt} value={bt}>
                    {brevtypeEtikett(bt)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-hjelp font-medium text-blekk">
              Saksnummer
              <input
                type="text"
                value={saksnummer}
                onChange={(e) => setSaksnummer(e.target.value)}
                placeholder="Valgfritt"
                className={feltKlasse}
              />
            </label>
          </div>

          {kanLagre ? (
            // Funnene kommer rolig inn idet tallene er bekreftet.
            <m.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={FJAER}
            >
              <Gebyrsjekk
                resultat={gebyrsjekk}
                hovedstol={hovedstolGrunnlag}
                className="mt-5"
              />
            </m.div>
          ) : (
            <p className="mt-5 text-hjelp text-dempet">
              Bekreft tallene over, så sjekker vi gebyrer og frister.
            </p>
          )}

          <div className="mt-5">
            <p className="text-hjelp font-medium text-blekk">Hører til</p>
            {kravForslag && kravModus === "ny" && (
              <button
                type="button"
                onClick={() => {
                  setKravModus("eksisterende");
                  setValgtKrav(kravForslag.id);
                  haptikk("lett");
                }}
                className="trykk mt-2 flex w-full items-center justify-between gap-3 rounded-xl border-[0.5px] border-aksent/40 bg-aksent/5 px-3.5 py-3 text-left"
              >
                <span className="text-hjelp text-blekk">
                  Ligner kravet «{kravForslag.navn}» —{" "}
                  {kravForslag.grunn === "saksnummer"
                    ? "samme saksnummer"
                    : "samme avsender"}
                  . Er det samme sak?
                </span>
                <span className="shrink-0 text-hjelp font-medium text-aksent">
                  Ja, legg til der
                </span>
              </button>
            )}
            <div className="mt-2 flex flex-col gap-2">
              {krav.length > 0 && (
                <label className="flex items-center gap-2.5 text-sm text-blekk">
                  <input
                    type="radio"
                    name="krav"
                    checked={kravModus === "eksisterende"}
                    onChange={() => setKravModus("eksisterende")}
                    className="accent-aksent"
                  />
                  <select
                    value={valgtKrav}
                    onChange={(e) => {
                      setValgtKrav(e.target.value);
                      setKravModus("eksisterende");
                    }}
                    className="rounded-kontroll border border-strek bg-flate px-3 py-2 text-sm text-blekk outline-none focus:border-aksent"
                  >
                    {krav.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.navn}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex items-center gap-2.5 text-sm text-blekk">
                <input
                  type="radio"
                  name="krav"
                  checked={kravModus === "ny"}
                  onChange={() => setKravModus("ny")}
                  className="accent-aksent"
                />
                Opprett nytt krav
              </label>
            </div>
          </div>

          {valgtKravVenter && (
            <div className="mt-5">
              <p className="text-hjelp font-medium text-blekk">
                Hva betyr svaret?
              </p>
              <p className="mt-0.5 text-hjelp text-dempet">
                Er dette svaret på det du sendte? Bekreft utfallet.
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {UTFALL_VALGBARE.map((u) => (
                  <label
                    key={u}
                    className={`flex items-center gap-2.5 rounded-xl border-[0.5px] px-3.5 py-3 text-sm transition ${
                      utfall === u
                        ? "border-aksent bg-aksent/5 text-blekk"
                        : "border-strek text-blekk"
                    }`}
                  >
                    <input
                      type="radio"
                      name="utfall"
                      checked={utfall === u}
                      onChange={() => setUtfall(u)}
                      className="accent-aksent"
                    />
                    {UTFALL_ETIKETT[u]}
                  </label>
                ))}
                <button
                  type="button"
                  onClick={() => setUtfall("")}
                  className="mt-1 self-start text-hjelp text-dempet underline decoration-strek underline-offset-4 transition hover:text-blekk"
                >
                  Vet ikke / la stå tomt
                </button>
              </div>
            </div>
          )}

          {((kanLagre && fristSammenligning) || fristForslag.length > 0) && (
            <div className="mt-5">
              <p className="text-hjelp font-medium text-blekk">
                Foreslåtte frister
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {kanLagre && fristSammenligning &&
                  (fristSammenligning.status === "avvik_kortere" ? (
                    <label className="flex items-start justify-between gap-3 rounded-xl border-[0.5px] border-dom-rod bg-dom-rod-bg px-3.5 py-2.5">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-dom-rod">
                          {formaterKortDato(fristSammenligning.visForfallsdato)}
                        </span>
                        <span className="mt-1 block text-[12.5px] leading-snug text-blekk">
                          Brevet oppgir{" "}
                          {formaterDato(fristSammenligning.eksplisittDato as string)}
                          , men loven krever minst {LOVBESTEMT_FRIST_DAGER} dager —
                          fristen kan være for kort. Vi bruker likevel brevets
                          dato, siden det er den du faktisk må forholde deg til.
                        </span>
                      </span>
                      <Avkrysning
                        checked={fristSammenligningAv}
                        onChange={setFristSammenligningAv}
                        className="mt-0.5"
                      />
                    </label>
                  ) : (
                    <label className="flex items-center justify-between gap-3 rounded-xl border-[0.5px] border-strek bg-flate px-3.5 py-2.5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-blekk">
                          {fristSammenligning.visTittel}
                        </span>
                        <span className="text-xs text-dempet">
                          {formaterKortDato(fristSammenligning.visForfallsdato)}
                        </span>
                      </span>
                      <Avkrysning
                        checked={fristSammenligningAv}
                        onChange={setFristSammenligningAv}
                      />
                    </label>
                  ))}
                {fristForslag.map((f, i) => (
                  <label
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-xl border-[0.5px] border-strek bg-flate px-3.5 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-blekk">
                        {f.tittel}
                      </span>
                      <span className="text-xs text-dempet">
                        {f.forfallsdato
                          ? formaterKortDato(f.forfallsdato)
                          : "ingen dato i brevet"}
                        {f.kilde === "beregnet" ? " · beregnet — sjekk brevet" : ""}
                      </span>
                    </span>
                    <Avkrysning
                      checked={!!fristAv[i] && !!f.forfallsdato}
                      disabled={!f.forfallsdato}
                      onChange={(v) => setFristAv((s) => ({ ...s, [i]: v }))}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {analyse.foreslatte_steg.length > 0 && (
            <div className="mt-5">
              <p className="text-hjelp font-medium text-blekk">
                Foreslåtte steg
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {analyse.foreslatte_steg.map((s, i) => (
                  <label
                    key={i}
                    className="flex items-start justify-between gap-3 rounded-xl border-[0.5px] border-strek bg-flate px-3.5 py-2.5"
                  >
                    <span className="text-sm text-blekk">{s}</span>
                    <Avkrysning
                      checked={stegAv[i] !== false}
                      onChange={(v) => setStegAv((st) => ({ ...st, [i]: v }))}
                      className="mt-0.5"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {feil && <p className="mt-4 text-hjelp text-dom-rod">{feil}</p>}

          {kanLagre && (
          <div className="mt-6">
            <Veivalg
              harGebyrfunn={(gebyrsjekk?.antallOver ?? 0) > 0}
              gebyrDifferanse={gebyrDifferanse}
              svarMål={{
                type: "klikk",
                onKlikk: () => lagre("innsigelse"),
                deaktivert: lagrer || !kanLagre,
              }}
              betaleMål={{
                type: "klikk",
                onKlikk: () => lagre("veier-ut"),
                deaktivert: lagrer || !kanLagre,
              }}
              ekstra={
                <button
                  type="button"
                  disabled={lagrer || !kanLagre}
                  onClick={() => lagre("krav")}
                  className="trykk mt-3 block text-hjelp text-dempet underline decoration-strek underline-offset-4 transition hover:text-blekk disabled:opacity-60"
                >
                  {lagrer ? "Lagrer …" : "Bestem senere — lagre i tidslinjen"}
                </button>
              }
            />
          </div>
          )}
        </m.div>
      )}
      </AnimatePresence>
    </m.main>
    </Bevegelsesramme>
  );
}

function InntakKort({
  ikon,
  tittel,
  tekst,
  onClick,
}: {
  ikon: React.ReactNode;
  tittel: string;
  tekst: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3.5 rounded-kontroll border border-strek bg-flate px-4 py-4 text-left transition hover:border-aksent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aksent"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-aksent/10 text-aksent">
        {ikon}
      </span>
      <span>
        <span className="block text-sm font-medium text-blekk">{tittel}</span>
        <span className="block text-hjelp text-dempet">{tekst}</span>
      </span>
    </button>
  );
}
