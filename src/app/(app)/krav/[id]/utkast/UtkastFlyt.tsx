"use client";

import { useMemo, useState, useTransition } from "react";
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
import { markerUtkastSendt } from "./actions";

// Lengste markør avgjør hvor mange tegn i halen av bufferet som må holdes
// tilbake (kan være et påbegynt, men ennå ikke fullstendig mottatt markørtegn).
const MAKS_MARKØR_LEN = Math.max(
  UTKAST_STRØM_MARKØR.FERDIG.length,
  UTKAST_STRØM_MARKØR.JUSTERER.length,
  UTKAST_STRØM_MARKØR.FEIL.length,
);

const GENERISK_FEIL = "Noe gikk galt. Prøv igjen om litt.";

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
  harOverGebyr,
  gebyrDiff,
  ubestridt,
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
  /** Sum kr over lovlig sats i brevet (0 = ingen gebyrfunn). */
  gebyrDiff: number;
  /** Totalen minus gebyrDiff; null når totalen er ukjent eller ingen funn. */
  ubestridt: number | null;
  avdrag?: AvdragsForslag | null;
  navnStart: string;
}) {
  const router = useRouter();
  const [type, setType] = useState<UtkastType>(starttype);
  const [detaljer, setDetaljer] = useState("");
  const [navn, setNavn] = useState(navnStart);
  // «Hva er du uenig i?» (§D.1): kun for innsigelse med gebyrfunn, og da er
  // «bare gebyret» forhåndsvalgt. Uten gebyrfunn er omfanget alltid «helt».
  const [omfangValg, setOmfangValg] = useState<Omfang>("delvis");
  const visOmfang = type === "innsigelse" && gebyrDiff > 0;
  const omfang: Omfang = visOmfang ? omfangValg : "helt";
  // Omfanget utkastet faktisk ble laget med (til betalingsmerknaden).
  const [omfangBrukt, setOmfangBrukt] = useState<Omfang | null>(null);

  // «Sjekk før du sender» (§D.4): vaktfaktaene kommer fra serveren sammen med
  // utkastet; vakten kjøres på nytt her når brukeren har redigert (ved blur).
  const [vaktFakta, setVaktFakta] = useState<VaktFakta | null>(null);
  const [kontrollTekst, setKontrollTekst] = useState("");
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
    // Speiler `tekst` lokalt, så sluttkontrollen får hele teksten uten å
    // vente på en re-render.
    let samlet = "";
    function leggTilTekst(biter: string) {
      if (!biter) return;
      tilStrømmevisning();
      if (ventendeErstatning) {
        ventendeErstatning = false;
        setJusterer(false);
        samlet = biter;
        setTekst(biter);
      } else {
        samlet += biter;
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

      // Sluttmarkøren bærer { id, advarsler, fakta } som JSON (route.ts).
      let slutt: { id: string; fakta: VaktFakta | null };
      try {
        const p = JSON.parse(ferdigId) as { id: string; fakta?: VaktFakta };
        slutt = { id: p.id, fakta: p.fakta ?? null };
      } catch {
        slutt = { id: ferdigId, fakta: null };
      }
      setUtkastId(slutt.id);
      setVaktFakta(slutt.fakta);
      // Siste tekst fra strømmen — samme tekst serveren kontrollerte.
      setKontrollTekst(samlet);
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
      <FaseLinje aktiv={fase === "skjema" ? 0 : fase === "strømmer" ? 1 : 2} />
      {fase === "skjema" ? (
        <>
          {harOverGebyr && (
            <p className="mb-3 rounded-xl bg-dom-rod-bg px-3.5 py-2.5 text-hjelp leading-relaxed text-dom-rod">
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
                  <span className="block text-meta text-dempet">
                    {UTKAST_UNDERTEKST[t]}
                  </span>
                </span>
              </label>
            ))}
          </div>

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
                    className={`flex items-center gap-2.5 rounded-xl border-[0.5px] px-3.5 py-3 text-sm text-blekk transition ${
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
            {UTKAST_SPORSMAL[type]}
            <textarea
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

          {feil && <p className="mt-3 text-hjelp text-dom-rod">{feil}</p>}

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
              <p className="mt-3 text-hjelp leading-relaxed text-dempet">
                Les gjennom og endre det som trengs — så sender du det selv
                {avsender ? ` til ${avsender}` : ""}.
              </p>

              {omfangBrukt === "delvis" && ubestridt !== null && (
                <Kort className="mt-4">
                  <p className="text-[13.5px] text-blekk">
                    Husk å betale {kr(ubestridt)} kr innen fristen. Da kommer
                    det ikke nye kostnader på den delen.
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
                  <h2 className="seksjonstittel text-blekk">Sjekk før du sender</h2>
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
                    Du sender brevet selv, så les det gjennom før du sender.
                  </p>
                </Kort>
              )}

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

              {feil && <p className="mt-3 text-hjelp text-dom-rod">{feil}</p>}

              {/* Egen seksjon: dette er en registrering brukeren gjør etter å
                  ha sendt selv — appen sender aldri noe. */}
              <div className="mt-seksjon border-t-[0.5px] border-strek pt-5">
                <h2 className="seksjonstittel text-blekk">Har du sendt brevet?</h2>
                <div className="mt-gruppe">
                  <Primærknapp
                    variant="rolig"
                    onClick={jegHarSendtDet}
                    disabled={sender}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Check className="size-4" aria-hidden />
                      {sender ? "Lagrer …" : "Jeg har sendt det"}
                    </span>
                  </Primærknapp>
                </div>
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
