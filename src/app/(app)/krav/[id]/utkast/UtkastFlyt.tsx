"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { m, useReducedMotion } from "motion/react";
import { Copy, Check, Mail, Loader2 } from "lucide-react";
import { Primærknapp } from "@/components/ui";
import { haptikk } from "@/lib/haptikk";
import { VARIGHET } from "@/lib/bevegelse";
import { UTKAST_STRØM_MARKØR } from "@/lib/ai";
import {
  UTKAST_TYPER,
  UTKAST_ETIKETT,
  UTKAST_SPORSMAL,
  UTKAST_UNDERTEKST,
  type UtkastType,
} from "@/lib/types";
import type { AvdragsForslag } from "@/lib/avdrag";
import { markerUtkastSendt } from "./actions";

// Lengste markør avgjør hvor mange tegn i halen av bufferet som må holdes
// tilbake (kan være et påbegynt, men ennå ikke fullstendig mottatt markørtegn).
const MAKS_MARKØR_LEN = Math.max(
  UTKAST_STRØM_MARKØR.FERDIG.length,
  UTKAST_STRØM_MARKØR.JUSTERER.length,
  UTKAST_STRØM_MARKØR.FEIL.length,
);

const GENERISK_FEIL = "Noe gikk galt. Prøv igjen om litt.";

export function UtkastFlyt({
  sakId,
  brevId,
  avsender,
  avsenderEpost,
  kreditor,
  saksnummer,
  starttype,
  harOverGebyr,
  avdrag,
  navnStart,
}: {
  sakId: string;
  brevId: string | null;
  avsender: string | null;
  avsenderEpost: string | null;
  kreditor: string;
  saksnummer: string | null;
  starttype: UtkastType;
  harOverGebyr: boolean;
  avdrag?: AvdragsForslag | null;
  navnStart: string;
}) {
  const router = useRouter();
  const [type, setType] = useState<UtkastType>(starttype);
  const [detaljer, setDetaljer] = useState("");
  const [navn, setNavn] = useState(navnStart);

  // "skjema": skjemaet vises, «Lag utkast»-knappen kan trykkes.
  // "strømmer": brevet skrives frem live, feltet er skrivebeskyttet.
  // "ferdig": strømmen er ferdig og kontrollert — feltet er redigerbart.
  const [fase, setFase] = useState<"skjema" | "strømmer" | "ferdig">("skjema");
  const [genererer, setGenererer] = useState(false);
  const [tekst, setTekst] = useState("");
  const [justerer, setJusterer] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [utkastId, setUtkastId] = useState<string | null>(null);
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
        }),
      });

      if (resp.status === 402) {
        router.push("/pluss");
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
        if (feilet) break;
        if (fantFerdig) continue;

        // Hold tilbake en hale som kan være en påbegynt markør, ikke innhold.
        if (buffer.length > MAKS_MARKØR_LEN - 1) {
          const tryggLen = buffer.length - (MAKS_MARKØR_LEN - 1);
          leggTilTekst(buffer.slice(0, tryggLen));
          buffer = buffer.slice(tryggLen);
        }
      }

      if (feilet || !ferdigId) {
        setFase("skjema");
        setGenererer(false);
        setFeil(GENERISK_FEIL);
        return;
      }

      setUtkastId(ferdigId);
      setFase("ferdig");
      haptikk("suksess");
    } catch {
      setFase("skjema");
      setGenererer(false);
      setFeil(GENERISK_FEIL);
    }
  }

  async function kopier() {
    if (!tekst) return;
    try {
      await navigator.clipboard.writeText(tekst);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2000);
    } catch {
      /* ignorer — brukeren kan markere og kopiere manuelt */
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
    if (forLangtForMailto && tekst) {
      try {
        await navigator.clipboard.writeText(tekst);
        setKopiert(true);
        setTimeout(() => setKopiert(false), 2000);
      } catch {
        /* ignorer — brukeren kan bruke Kopier-knappen manuelt */
      }
    }
    window.location.href = mailtoHref;
  }

  function jegHarSendtDet() {
    if (!utkastId) return;
    startSending(async () => {
      const r = await markerUtkastSendt(utkastId);
      if (!r.ok) {
        setFeil(r.feil);
        return;
      }
      haptikk("suksess");
      router.push(`/krav/${r.sakId}`);
      router.refresh();
    });
  }

  return (
    <div>
      {fase === "skjema" ? (
        <>
          {harOverGebyr && (
            <p className="mb-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-red-700">
              Gebyrsjekken fant et beløp over maksimalsats — dette tas med i
              utkastet.
            </p>
          )}
          <div className="flex flex-col gap-2">
            {UTKAST_TYPER.map((t) => (
              <label
                key={t}
                className={`flex items-start gap-2.5 rounded-xl border-[0.5px] px-3.5 py-3 text-sm transition ${
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
                  <span className="block text-[12px] text-dempet">
                    {UTKAST_UNDERTEKST[t]}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <label className="mt-5 block text-[13px] font-medium text-blekk">
            {UTKAST_SPORSMAL[type]}
            <textarea
              value={detaljer}
              onChange={(e) => setDetaljer(e.target.value)}
              rows={5}
              placeholder="Skriv kort med egne ord. La stå tomt om du er usikker."
              className="mt-1.5 w-full resize-none rounded-2xl border-[0.5px] border-strek bg-flate p-4 text-sm leading-relaxed text-blekk outline-none focus:border-aksent focus-visible:ring-2 focus-visible:ring-aksent/30"
            />
          </label>

          {/* Kun når navnet ikke allerede er satt på Meg — er det satt der,
              brukes det uten å spørre på nytt her (§6, utkast-stemme). */}
          {!navnStart.trim() && (
            <label className="mt-5 block text-[13px] font-medium text-blekk">
              Navnet ditt (slik det skal stå i brevet)
              <input
                type="text"
                value={navn}
                onChange={(e) => setNavn(e.target.value)}
                placeholder="Fullt navn"
                className="mt-1.5 w-full rounded-[10px] border-[0.5px] border-strek bg-flate px-3.5 py-3 text-sm text-blekk outline-none focus:border-aksent focus-visible:ring-2 focus-visible:ring-aksent/30"
              />
            </label>
          )}

          {feil && <p className="mt-3 text-[13px] text-red-700">{feil}</p>}

          <div className="mt-5">
            <Primærknapp onClick={generer} disabled={genererer}>
              {genererer ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Lag utkast
                </span>
              ) : (
                "Lag utkast"
              )}
            </Primærknapp>
          </div>
        </>
      ) : (
        <>
          {fase === "ferdig" ? (
            <textarea
              value={tekst}
              onChange={(e) => setTekst(e.target.value)}
              rows={16}
              className="w-full resize-none rounded-2xl border-[0.5px] border-strek bg-flate p-4 text-sm leading-relaxed text-blekk outline-none focus:border-aksent focus-visible:ring-2 focus-visible:ring-aksent/30"
            />
          ) : (
            <>
              <m.div
                aria-live="polite"
                animate={{ opacity: justerer ? 0.35 : 1 }}
                transition={{ duration: redusert ? 0 : VARIGHET.hurtig }}
                className="min-h-[380px] w-full whitespace-pre-wrap rounded-2xl border-[0.5px] border-strek bg-flate p-4 text-sm leading-relaxed text-blekk"
              >
                {tekst}
                {!justerer && tekst && (
                  <span
                    aria-hidden
                    className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-blekk align-middle"
                  />
                )}
              </m.div>
              {justerer && (
                <p className="mt-2 text-[13px] text-dempet">
                  Justerer ordlyden …
                </p>
              )}
            </>
          )}

          {fase === "ferdig" && (
            <>
              <p className="mt-3 text-[13px] leading-relaxed text-dempet">
                Les gjennom og endre det som trengs — så sender du det selv
                {avsender ? ` til ${avsender}` : ""}.
              </p>

              <div className="mt-4">
                {forLangtForMailto ? (
                  <Primærknapp onClick={apneEpost}>
                    <span className="inline-flex items-center gap-2">
                      <Mail className="size-4" aria-hidden />
                      Kopier og åpne i e-post
                    </span>
                  </Primærknapp>
                ) : (
                  <Primærknapp href={mailtoHref}>
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
                  className="trykk inline-flex items-center gap-2 rounded-[10px] border-[0.5px] border-strek bg-flate px-4 py-2.5 text-sm font-medium text-blekk hover:border-aksent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aksent"
                >
                  {kopiert ? (
                    <Check className="size-4 text-trygg" aria-hidden />
                  ) : (
                    <Copy className="size-4" aria-hidden />
                  )}
                  {kopiert ? "Kopiert" : "Kopier"}
                </button>
                <p className="text-xs leading-relaxed text-dempet">
                  Ble ikke hele brevet med? Bruk Kopier og lim inn.
                </p>
              </div>

              {feil && <p className="mt-3 text-[13px] text-red-700">{feil}</p>}

              <div className="mt-6 border-t-[0.5px] border-strek pt-4">
                <button
                  type="button"
                  onClick={jegHarSendtDet}
                  disabled={sender}
                  className="trykk inline-flex items-center gap-2 rounded-[10px] border-[0.5px] border-aksent/40 px-4 py-2.5 text-sm font-medium text-aksent hover:bg-aksent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aksent disabled:opacity-50"
                >
                  <Check className="size-4" aria-hidden />
                  {sender ? "Lagrer …" : "Jeg har sendt det"}
                </button>
                <p className="mt-2 text-xs leading-relaxed text-dempet">
                  Da settes saken til «Venter på svar», og vi følger opp om
                  det drøyer.
                </p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
