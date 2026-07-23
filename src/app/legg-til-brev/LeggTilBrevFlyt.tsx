"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { m } from "motion/react";
import { X, Camera, Upload, Type, Trash2 } from "lucide-react";
import { Primærknapp } from "@/components/ui";
import { Bevegelsesramme } from "@/components/Bevegelsesramme";
import { VARIGHET, EASING } from "@/lib/bevegelse";
import { haptikk } from "@/lib/haptikk";
import { BREVTYPER, STADIUM_ETIKETT, type BrevType } from "@/lib/gjeld";
import { formaterKortDato } from "@/lib/dato";
import {
  UTFALL_VALGBARE,
  UTFALL_ETIKETT,
  type FristForslag,
  type SakUtfall,
} from "@/lib/types";
import { svarUtfallTilSak } from "@/lib/utfall";
import { Gebyrsjekk } from "@/components/Gebyrsjekk";
import { Veivalg } from "@/components/Veivalg";
import { LeserBrev } from "./LeserBrev";
import { sjekkKostnader } from "@/lib/gebyr";
import {
  analyserBrevTekst,
  analyserBrevBilder,
  lagreBrev,
  type AnalyseResultat,
  type LagreBrevInput,
  type KravForslag,
  type Bilde,
} from "./actions";

type AnalyseData = Extract<AnalyseResultat, { ok: true }>["analyse"];
type KravValg = { id: string; navn: string; venter: boolean };
type Inntak = "valg" | "tekst" | "bilde";
type ValgtBilde = Bilde & { navn: string };

function brevtypeEtikett(bt: BrevType): string {
  return bt === "annet" ? "Annet" : STADIUM_ETIKETT[bt];
}

/** Beløpstekst (sifre + evt. mellomrom) → tall, ellers null. */
function tolkTall(s: string): number | null {
  if (!s.trim()) return null;
  const n = Number(s.replace(/\s/g, ""));
  return Number.isNaN(n) ? null : n;
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
  const [stegAv, setStegAv] = useState<Record<number, boolean>>({});
  const [utfall, setUtfall] = useState<SakUtfall | "">("");

  // Gebyrsjekken beregnes reaktivt fra kostnadslinjene AI-en fant og de
  // (redigerbare) verdiene i steg 3 — retter du beløpet, følger panelet med.
  // Salærgrunnlaget er hovedstol når den finnes, ellers totalbeløpet.
  const gebyrsjekk = useMemo(() => {
    const linjer = analyse?.kostnadslinjer ?? [];
    if (linjer.length === 0) return null;
    const grunnlag = tolkTall(analyse?.hovedstol ?? "") ?? tolkTall(belop);
    return sjekkKostnader(linjer, grunnlag, brevdato || null);
  }, [analyse, belop, brevdato]);

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
    setSaksnummer(r.analyse.saksnummer);
    // Forslag om eksisterende krav — aldri auto-valgt. Vises kun når vi ikke
    // allerede er på et bestemt krav (forvalgtKrav). Brukeren bekrefter selv.
    setKravForslag(forvalgtKrav ? null : r.kravForslag);
    const eksplisitte: FristForslag[] = r.analyse.foreslatte_frister.map((f) => ({
      ...f,
      kilde: "brev_eksplisitt" as const,
    }));
    const beregnede: FristForslag[] = r.beregnetFrist
      ? [{ ...r.beregnetFrist, kilde: "beregnet" as const }]
      : [];
    const alle = [...eksplisitte, ...beregnede];
    setFristForslag(alle);
    setFristAv(Object.fromEntries(alle.map((f, i) => [i, !!f.forfallsdato])));
    // Forhåndsvalgt utfall fra AI (null ved «uklart» → ingen forhåndsvalg).
    setUtfall(svarUtfallTilSak(r.analyse.svar_utfall) ?? "");
    setSteg(3);
  }

  async function lesTekst() {
    setFeil(null);
    setSteg(2);
    const r = await analyserBrevTekst(tekst);
    if (!r.ok) {
      setFeil(r.feil);
      setSteg(1);
      return;
    }
    anvendAnalyse(r);
  }

  async function lesBilder() {
    setFeil(null);
    setSteg(2);
    const r = await analyserBrevBilder(bilder.map(({ media_type, data }) => ({ media_type, data })));
    if (!r.ok) {
      setFeil(r.feil);
      setSteg(1);
      return;
    }
    anvendAnalyse(r);
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
    if (!analyse) return;
    setLagrer(true);
    setFeil(null);

    const valgteFrister = fristForslag.filter((f, i) => f.forfallsdato && fristAv[i]);
    const valgteSteg = analyse.foreslatte_steg.filter((_, i) => stegAv[i] !== false);
    const belopTall = belop.trim() ? Number(belop.replace(/\s/g, "")) : null;

    const input: LagreBrevInput = {
      krav:
        kravModus === "eksisterende" && valgtKrav
          ? { modus: "eksisterende", sakId: valgtKrav }
          : { modus: "ny", kreditor: avsender },
      avsender,
      avsender_epost: avsenderEpost,
      brevtype: brevtype || null,
      brevdato,
      belop: belopTall != null && !Number.isNaN(belopTall) ? belopTall : null,
      saksnummer,
      original_tekst: originalTekst,
      forklaring: analyse.forklaring,
      foreslatte_steg: valgteSteg,
      valgteFrister,
      utfall: valgtKravVenter && utfall ? utfall : null,
      kostnadslinjer: analyse.kostnadslinjer,
      hovedstol: tolkTall(analyse.hovedstol),
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
    "mt-1.5 w-full rounded-[10px] border-[0.5px] border-strek bg-flate px-3.5 py-2.5 text-sm text-blekk outline-none focus:border-aksent focus-visible:ring-2 focus-visible:ring-aksent/30";

  return (
    <Bevegelsesramme>
    <m.main
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: VARIGHET.rolig, ease: EASING }}
      className="mx-auto flex min-h-screen w-full max-w-[640px] flex-col px-5 pt-4">
      <button
        type="button"
        aria-label="Avbryt"
        onClick={() => (inntak !== "valg" && steg === 1 ? setInntak("valg") : router.back())}
        className="-ml-1 mb-4 flex size-8 items-center justify-center text-dempet transition hover:text-blekk"
      >
        <X className="size-5" aria-hidden />
      </button>

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

      {steg === 1 && (
        <div className="flex flex-1 flex-col">
          <h1 className="font-serif text-[24px] font-medium tracking-[-0.01em] text-blekk">
            Legg til brev
          </h1>

          {inntak === "valg" && (
            <>
              <p className="mt-1.5 text-[13px] leading-relaxed text-dempet">
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
              {feil && <p className="mt-4 text-[13px] text-red-700">{feil}</p>}
            </>
          )}

          {inntak === "tekst" && (
            <>
              <p className="mt-1.5 text-[13px] leading-relaxed text-dempet">
                Lim inn teksten fra brevet, så leser Medhold det.
              </p>
              <textarea
                value={tekst}
                onChange={(e) => setTekst(e.target.value)}
                rows={12}
                placeholder="Lim inn teksten fra brevet her …"
                className="mt-4 w-full flex-1 resize-none rounded-2xl border-[0.5px] border-strek bg-flate p-4 text-sm leading-relaxed text-blekk outline-none focus:border-aksent focus-visible:ring-2 focus-visible:ring-aksent/30"
              />
              {feil && <p className="mt-3 text-[13px] text-red-700">{feil}</p>}
              <div className="mt-4 pb-8">
                <Primærknapp onClick={lesTekst} disabled={tekst.trim().length < 10}>
                  Les brevet
                </Primærknapp>
              </div>
            </>
          )}

          {inntak === "bilde" && (
            <>
              <p className="mt-1.5 text-[13px] leading-relaxed text-dempet">
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
                      className="text-dempet transition hover:text-red-700"
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
              {feil && <p className="mt-3 text-[13px] text-red-700">{feil}</p>}
              <div className="mt-4 pb-8">
                <Primærknapp onClick={lesBilder} disabled={bilder.length === 0}>
                  Les brevet
                </Primærknapp>
              </div>
            </>
          )}
        </div>
      )}

      {steg === 2 && <LeserBrev />}

      {steg === 3 && analyse && (
        <div className="flex flex-1 flex-col pb-8">
          <h1 className="font-serif text-[24px] font-medium tracking-[-0.01em] text-blekk">
            Slik forstår vi brevet
          </h1>

          <div className="mt-4 rounded-2xl border-[0.5px] border-strek bg-flate p-4">
            <p className="whitespace-pre-line text-sm leading-relaxed text-blekk">
              {analyse.forklaring}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <label className="col-span-2 block text-[13px] font-medium text-blekk">
              Avsender
              <input
                type="text"
                value={avsender}
                onChange={(e) => setAvsender(e.target.value)}
                placeholder="F.eks. Kredinor"
                className={feltKlasse}
              />
            </label>
            <label className="col-span-2 block text-[13px] font-medium text-blekk">
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
            <label className="block text-[13px] font-medium text-blekk">
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
            <label className="block text-[13px] font-medium text-blekk">
              Beløp (kr)
              <input
                type="text"
                inputMode="numeric"
                value={belop}
                onChange={(e) => setBelop(e.target.value)}
                placeholder="F.eks. 12480"
                className={feltKlasse}
              />
            </label>
            <label className="col-span-2 block text-[13px] font-medium text-blekk">
              Brevdato
              <input
                type="date"
                value={brevdato}
                onChange={(e) => setBrevdato(e.target.value)}
                className={feltKlasse}
              />
            </label>
            <label className="col-span-2 block text-[13px] font-medium text-blekk">
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

          <Gebyrsjekk resultat={gebyrsjekk} className="mt-5" />

          <div className="mt-5">
            <p className="text-[13px] font-medium text-blekk">Hører til</p>
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
                <span className="text-[13px] text-blekk">
                  Ligner kravet «{kravForslag.navn}» —{" "}
                  {kravForslag.grunn === "saksnummer"
                    ? "samme saksnummer"
                    : "samme avsender"}
                  . Er det samme sak?
                </span>
                <span className="shrink-0 text-[13px] font-medium text-aksent">
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
                    className="rounded-[10px] border-[0.5px] border-strek bg-flate px-3 py-2 text-sm text-blekk outline-none focus:border-aksent"
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
              <p className="text-[13px] font-medium text-blekk">
                Hva betyr svaret?
              </p>
              <p className="mt-0.5 text-[13px] text-dempet">
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
                  className="mt-1 self-start text-[13px] text-dempet underline decoration-strek underline-offset-4 transition hover:text-blekk"
                >
                  Vet ikke / la stå tomt
                </button>
              </div>
            </div>
          )}

          {fristForslag.length > 0 && (
            <div className="mt-5">
              <p className="text-[13px] font-medium text-blekk">
                Foreslåtte frister
              </p>
              <div className="mt-2 flex flex-col gap-2">
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
                    <input
                      type="checkbox"
                      checked={!!fristAv[i] && !!f.forfallsdato}
                      disabled={!f.forfallsdato}
                      onChange={(e) =>
                        setFristAv((s) => ({ ...s, [i]: e.target.checked }))
                      }
                      className="size-4 accent-aksent disabled:opacity-40"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {analyse.foreslatte_steg.length > 0 && (
            <div className="mt-5">
              <p className="text-[13px] font-medium text-blekk">
                Foreslåtte steg
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {analyse.foreslatte_steg.map((s, i) => (
                  <label
                    key={i}
                    className="flex items-start justify-between gap-3 rounded-xl border-[0.5px] border-strek bg-flate px-3.5 py-2.5"
                  >
                    <span className="text-sm text-blekk">{s}</span>
                    <input
                      type="checkbox"
                      checked={stegAv[i] !== false}
                      onChange={(e) =>
                        setStegAv((st) => ({ ...st, [i]: e.target.checked }))
                      }
                      className="mt-0.5 size-4 shrink-0 accent-aksent"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {feil && <p className="mt-4 text-[13px] text-red-700">{feil}</p>}

          <div className="mt-6">
            <Veivalg
              harGebyrfunn={(gebyrsjekk?.antallOver ?? 0) > 0}
              gebyrDifferanse={gebyrDifferanse}
              svarMål={{
                type: "klikk",
                onKlikk: () => lagre("innsigelse"),
                deaktivert: lagrer,
              }}
              betaleMål={{
                type: "klikk",
                onKlikk: () => lagre("veier-ut"),
                deaktivert: lagrer,
              }}
              ekstra={
                <button
                  type="button"
                  disabled={lagrer}
                  onClick={() => lagre("krav")}
                  className="trykk mt-3 block text-[13px] text-dempet underline decoration-strek underline-offset-4 transition hover:text-blekk disabled:opacity-60"
                >
                  {lagrer ? "Lagrer …" : "Bestem senere — lagre i tidslinjen"}
                </button>
              }
            />
          </div>
        </div>
      )}
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
      className="flex items-center gap-3.5 rounded-2xl border-[0.5px] border-strek bg-flate px-4 py-4 text-left transition hover:border-aksent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aksent"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-aksent/10 text-aksent">
        {ikon}
      </span>
      <span>
        <span className="block text-sm font-medium text-blekk">{tittel}</span>
        <span className="block text-[13px] text-dempet">{tekst}</span>
      </span>
    </button>
  );
}
