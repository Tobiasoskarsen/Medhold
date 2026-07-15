"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Mail } from "lucide-react";
import { Primærknapp } from "@/components/ui";
import { haptikk } from "@/lib/haptikk";
import {
  UTKAST_TYPER,
  UTKAST_ETIKETT,
  UTKAST_SPORSMAL,
  type UtkastType,
} from "@/lib/types";
import { lagUtkast, markerUtkastSendt } from "./actions";

export function UtkastFlyt({
  sakId,
  brevId,
  avsender,
  avsenderEpost,
  kreditor,
  saksnummer,
  starttype,
  harOverGebyr,
}: {
  sakId: string;
  brevId: string | null;
  avsender: string | null;
  avsenderEpost: string | null;
  kreditor: string;
  saksnummer: string | null;
  starttype: UtkastType;
  harOverGebyr: boolean;
}) {
  const router = useRouter();
  const [type, setType] = useState<UtkastType>(starttype);
  const [detaljer, setDetaljer] = useState("");
  const [genererer, setGenererer] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [utkastId, setUtkastId] = useState<string | null>(null);
  const [innhold, setInnhold] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState(false);
  const [sender, startSending] = useTransition();

  async function generer() {
    setGenererer(true);
    setFeil(null);
    const r = await lagUtkast(sakId, brevId, type, detaljer);
    setGenererer(false);
    if (!r.ok) {
      if (r.paywall) {
        router.push("/pluss");
        return;
      }
      setFeil(r.feil ?? "Noe gikk galt. Prøv igjen.");
      return;
    }
    haptikk("suksess");
    setUtkastId(r.id);
    setInnhold(r.innhold);
  }

  async function kopier() {
    if (!innhold) return;
    try {
      await navigator.clipboard.writeText(innhold);
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
  const fullMailto = byggMailto(innhold ?? "");
  const forLangtForMailto = fullMailto.length > 1900;
  const mailtoHref = forLangtForMailto
    ? byggMailto("(Lim inn brevteksten her — den er kopiert til utklippstavlen.)")
    : fullMailto;

  async function apneEpost() {
    if (forLangtForMailto && innhold) {
      try {
        await navigator.clipboard.writeText(innhold);
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
      {!innhold ? (
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
                className={`flex items-center gap-2.5 rounded-xl border-[0.5px] px-3.5 py-3 text-sm transition ${
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
                  className="accent-aksent"
                />
                {UTKAST_ETIKETT[t]}
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

          {feil && <p className="mt-3 text-[13px] text-red-700">{feil}</p>}

          <div className="mt-5">
            <Primærknapp onClick={generer} disabled={genererer}>
              {genererer ? "Skriver utkast …" : "Lag utkast"}
            </Primærknapp>
          </div>
        </>
      ) : (
        <>
          <textarea
            value={innhold}
            onChange={(e) => setInnhold(e.target.value)}
            rows={16}
            className="w-full resize-none rounded-2xl border-[0.5px] border-strek bg-flate p-4 text-sm leading-relaxed text-blekk outline-none focus:border-aksent focus-visible:ring-2 focus-visible:ring-aksent/30"
          />
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
                Brevet er for langt for e-postfeltet — vi kopierer teksten og
                åpner en tom e-post du limer den inn i (Ctrl/Cmd+V).
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
                <Check className="size-4 text-aksent" aria-hidden />
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
              Da settes saken til «Venter på svar», og vi følger opp om det
              drøyer.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
