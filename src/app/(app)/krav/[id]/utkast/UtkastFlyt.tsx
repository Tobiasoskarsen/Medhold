"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { Copy, Check, Mail, Loader2 } from "lucide-react";
import { Kort, Primærknapp } from "@/components/ui";
import {
  kontrollerUtkast,
  verdierMedKilde,
  type VaktFakta,
} from "@/lib/utkast-vakt";
import { kr } from "@/lib/gebyrfunn-visning";
import { haptikk } from "@/lib/haptikk";
import { FJAER, VARIGHET } from "@/lib/bevegelse";
import { UTKAST_STRØM_MARKØR } from "@/lib/ai";
import {
  UTKAST_TYPER,
  UTKAST_ETIKETT,
  UTKAST_SPORSMAL,
  UTKAST_UNDERTEKST,
  type UtkastType,
} from "@/lib/types";
import type { AvdragsForslag } from "@/lib/avdrag";
import { lagreRedigertUtkast, markerUtkastSendt } from "./actions";
import { maskerFodselsnummer } from "@/lib/maskering";

// Lengste markør avgjør hvor mange tegn i halen av bufferet som må holdes
// tilbake (kan være et påbegynt, men ennå ikke fullstendig mottatt markørtegn).
const MAKS_MARKØR_LEN = Math.max(
  UTKAST_STRØM_MARKØR.FERDIG.length,
  UTKAST_STRØM_MARKØR.JUSTERER.length,
  UTKAST_STRØM_MARKØR.FEIL.length,
);

const GENERISK_FEIL = "Noe gikk galt. Prøv igjen om litt.";

/** Feilkoden serveren sender etter FEIL-markøren (api/utkast-generer). */
const UTKAST_FEIL: Record<string, string> = {
  avbrutt:
    "Utkastet ble for langt og ble avbrutt. Ingenting er lagret. Prøv igjen, gjerne med kortere opplysninger.",
  ugyldig_struktur: "Utkastet ble ufullstendig. Ingenting er lagret. Prøv igjen.",
  tidsavbrudd: "Det tok for lang tid å skrive utkastet. Ingenting er lagret. Prøv igjen.",
  nettverk: "Fikk ikke kontakt med skrivetjenesten. Ingenting er lagret. Prøv igjen om litt.",
  tjeneste: "Skrivetjenesten er travel akkurat nå. Ingenting er lagret. Prøv igjen om litt.",
  lagring: "Utkastet ble skrevet, men ikke lagret. Prøv igjen.",
};

type Omfang = "delvis" | "helt";

// Samme flate i alle faser, så teksten ikke hopper fra strømming til redigering.
const DOKUMENT =
  "min-h-[420px] w-full rounded-kort border border-kant bg-flate p-5 text-brod leading-[1.6] text-blekk";

const FASER = ["Opplysninger", "Skriver", "Les og rediger"] as const;

/** Hvor i flyten brukeren er. Ren visning av de tre eksisterende fasene. */
function FaseLinje({ aktiv }: { aktiv: 0 | 1 | 2 }) {
  return (
    <ol className="mb-5 flex items-center gap-1.5 text-meta font-medium text-dempet">
      {FASER.map((f, i) => (
        <li
          key={f}
          aria-current={i === aktiv ? "step" : undefined}
          className="flex items-center gap-1.5"
        >
          {i > 0 && <span className="h-px w-3 bg-strek" aria-hidden />}
          <span className={i === aktiv ? "font-bold text-blekk" : ""}>{f}</span>
        </li>
      ))}
    </ol>
  );
}

export function UtkastFlyt({
  sakId,
  brevId,
  avsender,
  avsenderEpost,
  kreditor,
  saksnummer,
  starttype,
  typeValgt,
  harOverGebyr,
  gebyrDiff,
  ubestridt,
  avdrag,
  navnStart,
  lagret,
  eierId,
}: {
  sakId: string;
  brevId: string | null;
  avsender: string | null;
  avsenderEpost: string | null;
  kreditor: string;
  saksnummer: string | null;
  starttype: UtkastType;
  /** Brukeren kom hit med valgt type: vis den som oppsummering med «Endre». */
  typeValgt: boolean;
  harOverGebyr: boolean;
  /** Sum kr over lovlig sats i brevet (0 = ingen gebyrfunn). */
  gebyrDiff: number;
  /** Totalen minus gebyrDiff; null når totalen er ukjent eller ingen funn. */
  ubestridt: number | null;
  avdrag?: AvdragsForslag | null;
  navnStart: string;
  lagret?: { id: string; innhold: string; versjon: number; sendt_at: string | null; sendt_innhold: string | null; vakt_fakta: VaktFakta | null };
  eierId?: string;
}) {
  const router = useRouter();
  const [type, setType] = useState<UtkastType>(starttype);
  const [visTyper, setVisTyper] = useState(!typeValgt);
  const [detaljer, setDetaljer] = useState("");
  const [navn, setNavn] = useState(navnStart);
  // «Hva er du uenig i?» (§D.1): kun for innsigelse med gebyrfunn, og da er
  // «bare gebyret» forhåndsvalgt. Uten gebyrfunn er omfanget alltid «helt».
  const [omfangValg, setOmfangValg] = useState<Omfang>("delvis");
  const visOmfang = type === "innsigelse" && gebyrDiff > 0;
  const omfang: Omfang = visOmfang ? omfangValg : "helt";
  // Omfanget utkastet faktisk ble laget med (til betalingsmerknaden).
  const [omfangBrukt, setOmfangBrukt] = useState<Omfang | null>(lagret?.vakt_fakta?.omfang ?? null);

  // «Sjekk før du sender» (§D.4): vaktfaktaene kommer fra serveren sammen med
  // utkastet; vakten kjøres på nytt her når brukeren har redigert (ved blur).
  const startTekst = lagret?.sendt_innhold ?? lagret?.innhold ?? "";
  const [vaktFakta, setVaktFakta] = useState<VaktFakta | null>(lagret?.vakt_fakta ?? null);
  const [kontrollTekst, setKontrollTekst] = useState(startTekst);
  const sjekk = useMemo(() => {
    if (!vaktFakta) return null;
    return {
      advarsler: kontrollerUtkast(kontrollTekst, vaktFakta),
      verdier: verdierMedKilde(kontrollTekst, vaktFakta),
    };
  }, [kontrollTekst, vaktFakta]);

  // "skjema": skjemaet vises, «Lag utkast»-knappen kan trykkes.
  // "strømmer": brevet skrives frem live, feltet er skrivebeskyttet.
  // "ferdig": strømmen er ferdig og kontrollert — feltet er redigerbart.
  const [fase, setFase] = useState<"skjema" | "strømmer" | "ferdig">(lagret ? "ferdig" : "skjema");
  const [genererer, setGenererer] = useState(false);
  const [tekst, setTekst] = useState(startTekst);
  const [lagretTekst, setLagretTekst] = useState(startTekst);
  const [versjon, setVersjon] = useState(lagret?.versjon ?? 1);
  const [lagrer, setLagrer] = useState(false);
  const erSendt = !!lagret?.sendt_at;
  const ulagret = tekst !== lagretTekst;
  useEffect(() => {
    if (!ulagret || fase !== "ferdig") return;
    const varsel = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const lenke = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest("a[href]") &&
        !window.confirm("Du har ulagrede endringer. Vil du forlate siden uten å lagre?")) {
        e.preventDefault(); e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", varsel);
    document.addEventListener("click", lenke, true);
    return () => { window.removeEventListener("beforeunload", varsel); document.removeEventListener("click", lenke, true); };
  }, [ulagret, fase]);
  const [justerer, setJusterer] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [utkastId, setUtkastId] = useState<string | null>(lagret?.id ?? null);
  const backupNokkel = eierId && utkastId ? `medhold-utkast-${eierId}-${utkastId}` : null;
  useEffect(() => {
    if (!backupNokkel || erSendt) return;
    let aktiv = true;
    // Etter hydrering; sessionStorage er kun en gjenopprettingsbuffer i denne
    // fanen, aldri en serverbekreftet lagring eller en sendt tekstversjon.
    queueMicrotask(() => {
      if (!aktiv) return;
      try {
        const b = JSON.parse(sessionStorage.getItem(backupNokkel) ?? "null");
        if (b && typeof b.tekst === "string" && b.tekst.length <= 50000 && Number.isInteger(b.versjon)) {
          setTekst(b.tekst); setKontrollTekst(b.tekst); setVersjon(b.versjon);
          setFeil("Ulagret tekst er gjenopprettet fra denne fanen. Kontroller og lagre den. Hvis en annen fane har endret utkastet, vil serveren avvise overskriving.");
        }
      } catch { /* Bufferen er valgfri; serverlagring er autoritativ. */ }
    });
    return () => { aktiv = false; };
  }, [backupNokkel, erSendt]);
  const [kopiert, setKopiert] = useState(false);
  const [sender, startSending] = useTransition();
  const redusert = useReducedMotion();

  async function generer() {
    setGenererer(true);
    setFeil(null);
    setTekst("");
    setJusterer(false);

    let visStrømming = false;
    function tilStrømmevisning() {
      if (!visStrømming) {
        visStrømming = true;
        setFase("strømmer");
        setGenererer(false);
      }
    }

    // Rett etter __JUSTERER__: den nedtonede, ukontrollerte teksten blir
    // stående til FØRSTE tegn fra regenereringen kommer — da erstattes den i
    // ett steg (§B.3: «deretter erstattes teksten fortløpende»), i stedet for
    // å tømmes brått idet markøren mottas.
    let ventendeErstatning = false;
    // Speiler `tekst` lokalt, så sluttkontrollen får hele teksten uten å
    // vente på en re-render.
    function leggTilTekst(biter: string) {
      if (!biter) return;
      tilStrømmevisning();
      if (ventendeErstatning) {
        ventendeErstatning = false;
        setJusterer(false);
        setTekst(biter);
      } else {
        setTekst((t) => t + biter);
      }
    }

    try {
      const resp = await fetch("/api/utkast-generer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kravId: sakId,
          brevId,
          type,
          detaljer,
          navn,
          avdrag: type === "nedbetalingsavtale" ? avdrag : null,
          omfang: type === "innsigelse" ? omfang : null,
        }),
      });

      if (resp.status === 402) {
        router.push("/pluss");
        return;
      }
      // Grense nådd eller kvoten kunne ikke sjekkes: serveren sier hvorfor.
      if (resp.status === 429 || resp.status === 409 || resp.status === 503) {
        const grunn = (await resp.text()).slice(0, 400);
        setGenererer(false);
        setFeil(grunn || GENERISK_FEIL);
        return;
      }
      if (!resp.ok || !resp.body) {
        setGenererer(false);
        setFeil(GENERISK_FEIL);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let ferdigId: string | null = null;
      let feilet = false;
      // Etter FEIL-markøren kommer feilkoden, som kan fordeles på flere reads.
      let feilKode = "";
      // Sant fra FERDIG-markøren er funnet: ID-en kan fortsette i SENERE
      // reads (markøren og id-en er ikke garantert å ankomme i samme
      // biffer/chunk) — alt som kommer etterpå er id, helt til strømmen
      // lukkes. Ingen egen sluttmarkør for id-en trengs (serveren lukker
      // strømmen rett etterpå).
      let idModus = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const del = decoder.decode(value, { stream: true });

        if (idModus) {
          ferdigId = (ferdigId ?? "") + del;
          continue;
        }
        if (feilet) {
          feilKode += del;
          continue;
        }
        buffer += del;

        // Behandle alle hele markører som måtte være i bufferet nå.
        let fantFerdig = false;
        for (;;) {
          const iFerdig = buffer.indexOf(UTKAST_STRØM_MARKØR.FERDIG);
          const iJusterer = buffer.indexOf(UTKAST_STRØM_MARKØR.JUSTERER);
          const iFeil = buffer.indexOf(UTKAST_STRØM_MARKØR.FEIL);
          const kandidater = [iFerdig, iJusterer, iFeil].filter(
            (i) => i >= 0,
          );
          if (kandidater.length === 0) break;
          const i = Math.min(...kandidater);

          leggTilTekst(buffer.slice(0, i));

          if (i === iFerdig) {
            idModus = true;
            ferdigId = buffer.slice(i + UTKAST_STRØM_MARKØR.FERDIG.length);
            buffer = "";
            fantFerdig = true;
            break;
          }
          if (i === iFeil) {
            feilet = true;
            feilKode = buffer.slice(i + UTKAST_STRØM_MARKØR.FEIL.length);
            buffer = "";
            break;
          }
          // Justerer: rolig overgang — ikke en feil (§B.3). Den nedtonede
          // teksten som allerede er vist blir stående (fades i UI-en) til
          // regenereringen begynner å komme — se leggTilTekst().
          tilStrømmevisning();
          setJusterer(true);
          ventendeErstatning = true;
          buffer = buffer.slice(i + UTKAST_STRØM_MARKØR.JUSTERER.length);
        }
        if (feilet || fantFerdig) continue;

        // Hold tilbake en hale som kan være en påbegynt markør, ikke innhold.
        if (buffer.length > MAKS_MARKØR_LEN - 1) {
          const tryggLen = buffer.length - (MAKS_MARKØR_LEN - 1);
          leggTilTekst(buffer.slice(0, tryggLen));
          buffer = buffer.slice(tryggLen);
        }
      }

      // Sluttmarkøren bærer { id, advarsler, fakta } som JSON (route.ts).
      // Mangler den, eller er den avkuttet, er utkastet ikke bekreftet lagret.
      let slutt: { id: string; fakta: VaktFakta | null; tekst: string; versjon: number } | null = null;
      if (!feilet && ferdigId) {
        try {
          const p = JSON.parse(ferdigId) as { id?: unknown; fakta?: VaktFakta; tekst?: unknown; versjon?: number };
          if (typeof p.id === "string" && p.id && typeof p.tekst === "string" && Number.isInteger(p.versjon))
            slutt = { id: p.id, fakta: p.fakta ?? null, tekst: p.tekst, versjon: p.versjon! };
        } catch {
          slutt = null;
        }
      }
      if (!slutt) {
        setFase("skjema");
        setGenererer(false);
        setTekst("");
        setFeil(UTKAST_FEIL[feilKode.trim()] ?? GENERISK_FEIL);
        return;
      }
      setUtkastId(slutt.id);
      setVaktFakta(slutt.fakta);
      // Siste tekst fra strømmen — samme tekst serveren kontrollerte.
      setTekst(slutt.tekst);
      setLagretTekst(slutt.tekst);
      setVersjon(slutt.versjon);
      setKontrollTekst(slutt.tekst);
      setOmfangBrukt(type === "innsigelse" ? omfang : null);
      setFase("ferdig");
      haptikk("suksess");
    } catch {
      setFase("skjema");
      setGenererer(false);
      setFeil(GENERISK_FEIL);
    }
  }

  async function kopier() {
    if (!tekst || ulagret || lagrer) return;
    try {
      await navigator.clipboard.writeText(tekst);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2000);
    } catch {
      setFeil("Kunne ikke kopiere. Marker teksten og kopier den manuelt.");
    }
  }

  // Sending skjer i brukerens egen e-postklient — appen sender aldri selv.
  function byggMailto(body: string): string {
    const emne = saksnummer
      ? `${UTKAST_ETIKETT[type]} – saksnummer ${saksnummer}`
      : `${UTKAST_ETIKETT[type]} – ${kreditor}`;
    return `mailto:${avsenderEpost ?? ""}?subject=${encodeURIComponent(
      emne,
    )}&body=${encodeURIComponent(body)}`;
  }

  // mailto-URL-er har praktiske lengdegrenser (Outlook/Windows kutter rundt
  // 2 000 tegn) — et helt innsigelsesbrev sprenger det lett, og da sendes et
  // avkuttet brev. Over terskel: kopier teksten og åpne en tom e-post med
  // placeholder i stedet. Deterministisk, ingen tapt tekst.
  const fullMailto = byggMailto(tekst);
  const forLangtForMailto = fullMailto.length > 1900;
  const mailtoHref = forLangtForMailto
    ? byggMailto("(Lim inn brevteksten her — den er kopiert til utklippstavlen.)")
    : fullMailto;

  async function apneEpost() {
    if (ulagret || lagrer) { setFeil("Lagre utkastet før du åpner e-post."); return; }
    if (forLangtForMailto && tekst) {
      try {
        await navigator.clipboard.writeText(tekst);
        setKopiert(true);
        setTimeout(() => setKopiert(false), 2000);
      } catch {
        setFeil("Kunne ikke kopiere hele brevet. Kopier manuelt før du åpner e-post.");
        return;
      }
    }
    window.location.href = mailtoHref;
  }

  function jegHarSendtDet() {
    if (!utkastId || ulagret || lagrer) { setFeil("Lagre utkastet før du registrerer det som sendt."); return; }
    startSending(async () => {
      setFeil(null);
      try {
        const r = await markerUtkastSendt(utkastId, versjon);
        if (!r.ok) {
          setFeil(r.feil);
          return;
        }
        haptikk("suksess");
        router.push(`/krav/${r.sakId}`);
        router.refresh();
      } catch {
        setFeil("Kunne ikke bekrefte registreringen. Teksten er beholdt. Prøv igjen, eller åpne utkastet på nytt for å kontrollere status.");
      }
    });
  }

  return (
    <div>
      <FaseLinje aktiv={fase === "skjema" ? 0 : fase === "strømmer" ? 1 : 2} />
      {fase === "skjema" ? (
        <>
          {harOverGebyr && (
            <p className="mb-3 rounded-kontroll bg-dom-rod-bg px-3.5 py-2.5 text-hjelp leading-relaxed text-dom-rod">
              Gebyrsjekken fant et beløp over maksimalsats — dette tas med i
              utkastet.
            </p>
          )}
          {!visTyper && (
            <div className="flex items-center justify-between gap-3 rounded-kort border border-kant bg-flate px-4 py-3">
              <span className="min-w-0">
                <span className="radtekst block">Brevtype</span>
                <span className="radtittel block text-blekk">{UTKAST_ETIKETT[type]}</span>
                <span className="radtekst block">{UTKAST_UNDERTEKST[type]}</span>
              </span>
              <button
                type="button"
                onClick={() => setVisTyper(true)}
                aria-label={`Endre brevtype, valgt er ${UTKAST_ETIKETT[type]}`}
                className="trykk flex min-h-11 shrink-0 items-center px-1 text-hjelp font-semibold text-aksent-dyp"
              >
                Endre
              </button>
            </div>
          )}
          {visTyper && (
          <div className="flex flex-col gap-2">
            {UTKAST_TYPER.map((t) => (
              <label
                key={t}
                className={`flex items-start gap-2.5 rounded-kontroll border-[0.5px] px-3.5 py-3 text-sm transition ${
                  type === t
                    ? "border-aksent bg-aksent/5 text-blekk"
                    : "border-strek text-blekk"
                }`}
              >
                <input
                  type="radio"
                  name="utkasttype"
                  checked={type === t}
                  onChange={() => setType(t)}
                  className="mt-0.5 accent-aksent"
                />
                <span>
                  <span className="block font-medium text-blekk">
                    {UTKAST_ETIKETT[t]}
                  </span>
                  <span className="block text-meta text-dempet">
                    {UTKAST_UNDERTEKST[t]}
                  </span>
                </span>
              </label>
            ))}
          </div>
          )}

          {visOmfang && (
            <fieldset className="mt-5">
              <legend className="text-hjelp font-medium text-blekk">
                Hva er du uenig i?
              </legend>
              <div className="mt-1.5 flex flex-col gap-2">
                {(
                  [
                    ["delvis", `Bare gebyret som er for høyt (${kr(gebyrDiff)} kr)`],
                    ["helt", "Hele kravet"],
                  ] as const
                ).map(([verdi, etikett]) => (
                  <label
                    key={verdi}
                    className={`flex items-center gap-2.5 rounded-kontroll border-[0.5px] px-3.5 py-3 text-sm text-blekk transition ${
                      omfangValg === verdi ? "border-aksent bg-aksent/5" : "border-strek"
                    }`}
                  >
                    <input
                      type="radio"
                      name="omfang"
                      checked={omfangValg === verdi}
                      onChange={() => setOmfangValg(verdi)}
                      className="accent-aksent"
                    />
                    {etikett}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <label className="mt-5 block text-hjelp font-medium text-blekk">
            {/* Omfanget spør allerede «Hva er du uenig i?» — ikke spør to ganger. */}
            {visOmfang ? "Hvorfor er du uenig?" : UTKAST_SPORSMAL[type]}
            {!UTKAST_SPORSMAL[type].includes("valgfritt") && (
              <span className="font-normal text-dempet"> (valgfritt)</span>
            )}
            <textarea
              readOnly={erSendt || lagrer}
              value={detaljer}
              onChange={(e) => setDetaljer(e.target.value)}
              rows={5}
              placeholder="Skriv kort med egne ord. La stå tomt om du er usikker."
              className="mt-1.5 w-full resize-none rounded-kontroll border border-strek bg-flate p-4 text-sm leading-relaxed text-blekk outline-none focus:border-aksent focus-visible:ring-2 focus-visible:ring-aksent/30"
            />
          </label>

          {/* Kun når navnet ikke allerede er satt på Meg — er det satt der,
              brukes det uten å spørre på nytt her (§6, utkast-stemme). */}
          {!navnStart.trim() && (
            <label className="mt-5 block text-hjelp font-medium text-blekk">
              Navnet ditt (slik det skal stå i brevet)
              <input
                type="text"
                value={navn}
                onChange={(e) => setNavn(e.target.value)}
                placeholder="Fullt navn"
                className="mt-1.5 w-full rounded-kontroll border border-strek bg-flate px-3.5 py-3 text-sm text-blekk outline-none focus:border-aksent focus-visible:ring-2 focus-visible:ring-aksent/30"
              />
            </label>
          )}

          {feil && <p role="alert" className="mt-3 text-hjelp text-dom-rod">{feil}</p>}

          <div className="mt-5">
            <Primærknapp onClick={generer} disabled={genererer}>
              {genererer ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Lag et utkast
                </span>
              ) : (
                "Lag et utkast"
              )}
            </Primærknapp>
          </div>
        </>
      ) : (
        <>
          {fase === "ferdig" ? (
            <textarea
              value={tekst}
              readOnly={erSendt || lagrer}
              aria-label="Utkast til brev"
              onChange={(e) => {
                const ny = e.target.value;
                setTekst(ny);
                if (backupNokkel) {
                  try { sessionStorage.setItem(backupNokkel, JSON.stringify({ tekst: maskerFodselsnummer(ny), versjon })); }
                  catch { setFeil("Lokal sikkerhetskopi er utilgjengelig. Lagre før du forlater siden."); }
                }
              }}
              onBlur={() => setKontrollTekst(tekst)}
              rows={16}
              className={`${DOKUMENT} resize-none outline-none focus:border-aksent focus-visible:ring-2 focus-visible:ring-aksent/30`}
            />
          ) : (
            <>
              <m.div
                aria-live="polite"
                animate={{ opacity: justerer ? 0.35 : 1 }}
                transition={{ duration: redusert ? 0 : VARIGHET.hurtig }}
                className={`${DOKUMENT} whitespace-pre-wrap`}
              >
                {tekst}
                {!justerer && tekst && (
                  <span
                    aria-hidden
                    className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-blekk align-middle"
                  />
                )}
              </m.div>
              {/* Plassen er alltid reservert: ingen hopp når teksten kommer. */}
              <p className="mt-2 h-5 text-hjelp text-dempet" aria-live="polite">
                {justerer ? "Justerer ordlyden …" : ""}
              </p>
            </>
          )}

          {fase === "ferdig" && (
            <>
              <p role="status" className="mt-3 text-hjelp text-dempet">{erSendt ? (lagret?.sendt_innhold ? "Registrert sendt – bevart tekstversjon." : "Eldre sendt utkast: eksakt sendt tekst er ikke dokumentert.") : ulagret ? "Ulagrede endringer" : "Utkast lagret"}</p>
              {!erSendt && <button type="button" disabled={!ulagret || lagrer} className="trykk min-h-11 underline" onClick={async () => {
                if (!utkastId) return;
                setLagrer(true); setFeil(null);
                try {
                  const r = await lagreRedigertUtkast(utkastId, sakId, versjon, tekst);
                  if (!r.ok) { setFeil(r.feil); return; }
                  setTekst(r.tekst); setKontrollTekst(r.tekst); setLagretTekst(r.tekst); setVersjon(r.versjon);
                  if (backupNokkel) { try { sessionStorage.removeItem(backupNokkel); } catch { /* lagret på server */ } }
                } catch { setFeil("Kunne ikke bekrefte lagringen. Teksten er beholdt. Prøv igjen, eller åpne utkastet på nytt for å kontrollere status."); }
                finally { setLagrer(false); }
              }}>{lagrer ? "Lagrer …" : "Lagre endringer"}</button>}
              {feil && <p role="alert" className="text-dom-rod">{feil}</p>}
              <p className="mt-3 text-hjelp leading-relaxed text-dempet">
                {erSendt
                  ? "Dette er teksten du registrerte som sendt. Den kan ikke endres."
                  : `Les gjennom og endre det som trengs — så sender du det selv${avsender ? ` til ${avsender}` : ""}.`}
              </p>
              <p className="mt-1.5 text-meta text-dempet">
                Automatisk utkast — ikke profesjonell rådgivning.
              </p>

              {omfangBrukt === "delvis" && ubestridt !== null && (
                <Kort className="mt-4">
                  <p className="text-[13.5px] text-blekk">
                    Husk å betale {kr(ubestridt)} kr innen fristen hvis du er
                    enig i den delen. Kontroller betalingsopplysningene mot brevet.
                  </p>
                </Kort>
              )}
              {omfangBrukt === "helt" && (
                <Kort className="mt-4">
                  <p className="text-[13.5px] text-blekk">
                    Er du bare uenig i en del av kravet, bør du betale resten
                    innen fristen.
                  </p>
                </Kort>
              )}

              {sjekk && (
                <Kort className="mt-4">
                  <h2 className="seksjonstittel text-blekk">{erSendt ? "Kontroll av sendt tekst" : "Sjekk før du sender"}</h2>
                  {sjekk.advarsler.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1">
                      {sjekk.advarsler.map((a, i) => (
                        <li key={i} className="text-hjelp font-semibold text-dom-rod">
                          {a.tekst}
                        </li>
                      ))}
                    </ul>
                  )}
                  {sjekk.verdier.length > 0 && (
                    <ul className="mt-2">
                      {sjekk.verdier.map((v) => (
                        <li
                          key={`${v.type}-${v.verdi}`}
                          className="flex items-baseline justify-between gap-3 border-t-[0.5px] border-strek py-2 text-hjelp first:border-t-0"
                        >
                          <span className="font-bold tabular-nums text-blekk">
                            {v.verdi}
                          </span>
                          <span className={v.kilde ? "text-dempet" : "text-dom-rod"}>
                            {v.kilde ?? "finnes ikke i saken"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-meta text-dempet">
                    {erSendt ? "Registreringen betyr at du har sendt brevet selv. Medhold har ikke sendt det." : "Du sender brevet selv, så les det gjennom før du sender."}
                  </p>
                </Kort>
              )}

              <h2 className="seksjonstittel mt-seksjon text-blekk">{erSendt ? "Kopi av sendt tekst" : "Send brevet selv"}</h2>
              <div className="mt-gruppe">
                {forLangtForMailto ? (
                  <Primærknapp onClick={apneEpost} disabled={ulagret || lagrer}>
                    <span className="inline-flex items-center gap-2">
                      <Mail className="size-4" aria-hidden />
                      Kopier og åpne i e-post
                    </span>
                  </Primærknapp>
                ) : (
                  <Primærknapp onClick={apneEpost} disabled={ulagret || lagrer}>
                    <span className="inline-flex items-center gap-2">
                      <Mail className="size-4" aria-hidden />
                      Åpne i e-post
                    </span>
                  </Primærknapp>
                )}
                {forLangtForMailto && (
                  <p className="mt-2 text-xs leading-relaxed text-dempet">
                    Brevet er for langt for e-postfeltet — vi kopierer teksten
                    og åpner en tom e-post du limer den inn i (Ctrl/Cmd+V).
                  </p>
                )}
              </div>

              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={kopier}
                  disabled={ulagret || lagrer}
                  className="trykk inline-flex min-h-11 shrink-0 items-center gap-2 rounded-kontroll border border-strek bg-flate px-4 py-2.5 text-sm font-medium text-blekk hover:border-aksent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aksent"
                >
                  {/* Ikonet morfer: kopi-ikonet roterer ut, haken fjærer inn. */}
                  <span className="relative flex size-4 items-center justify-center">
                    <AnimatePresence initial={false} mode="popLayout">
                      <m.span
                        key={kopiert ? "hake" : "kopi"}
                        initial={{ scale: 0.4, opacity: 0, rotate: kopiert ? -45 : 45 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        exit={{ scale: 0.4, opacity: 0 }}
                        transition={FJAER}
                        className="absolute"
                      >
                        {kopiert ? (
                          <Check className="size-4 text-trygg" aria-hidden />
                        ) : (
                          <Copy className="size-4" aria-hidden />
                        )}
                      </m.span>
                    </AnimatePresence>
                  </span>
                  {kopiert ? "Kopiert" : "Kopier"}
                </button>
                <p className="text-xs leading-relaxed text-dempet">
                  Ble ikke hele brevet med? Bruk Kopier og lim inn.
                </p>
              </div>

              {feil && <p role="alert" className="mt-3 text-hjelp text-dom-rod">{feil}</p>}

              {/* Egen seksjon: dette er en registrering brukeren gjør etter å
                  ha sendt selv — appen sender aldri noe. */}
              {!erSendt && <div className="mt-seksjon border-t-[0.5px] border-strek pt-5">
                <h2 className="seksjonstittel text-blekk">Har du sendt brevet?</h2>
                <div className="mt-gruppe">
                  <Primærknapp
                    variant="rolig"
                    onClick={jegHarSendtDet}
                    disabled={sender || ulagret || lagrer || erSendt}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Check className="size-4" aria-hidden />
                      {sender ? "Lagrer …" : "Jeg har sendt det"}
                    </span>
                  </Primærknapp>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-dempet">
                  Da settes saken til «Venter på svar». Medhold sender ikke noe
                  selv, men minner deg på å følge opp hvis det drøyer.
                </p>
              </div>}
            </>
          )}
        </>
      )}
    </div>
  );
}
