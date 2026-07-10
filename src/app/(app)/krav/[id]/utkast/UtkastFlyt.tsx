"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check } from "lucide-react";
import { Primærknapp } from "@/components/ui";
import { haptikk } from "@/lib/haptikk";
import {
  UTKAST_TYPER,
  UTKAST_ETIKETT,
  UTKAST_SPORSMAL,
  type UtkastType,
} from "@/lib/types";
import { lagUtkast } from "./actions";

export function UtkastFlyt({
  sakId,
  brevId,
  avsender,
  starttype,
}: {
  sakId: string;
  brevId: string | null;
  avsender: string | null;
  starttype: UtkastType;
}) {
  const router = useRouter();
  const [type, setType] = useState<UtkastType>(starttype);
  const [detaljer, setDetaljer] = useState("");
  const [genererer, setGenererer] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [innhold, setInnhold] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState(false);

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

  return (
    <div>
      {!innhold ? (
        <>
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
            Les gjennom, endre det som trengs, og send det selv
            {avsender ? ` til ${avsender}` : ""}.
          </p>
          <button
            type="button"
            onClick={kopier}
            className="mt-4 inline-flex items-center gap-2 rounded-[10px] border-[0.5px] border-strek bg-flate px-4 py-2.5 text-sm font-medium text-blekk transition hover:border-aksent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aksent"
          >
            {kopiert ? (
              <Check className="size-4 text-aksent" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
            {kopiert ? "Kopiert" : "Kopier"}
          </button>
        </>
      )}
    </div>
  );
}
