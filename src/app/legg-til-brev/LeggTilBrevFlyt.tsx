"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Primærknapp } from "@/components/ui";
import { BREVTYPER, STADIUM_ETIKETT, type BrevType } from "@/lib/gjeld";
import { formaterKortDato } from "@/lib/dato";
import type { BrevAnalyse, ForeslattFrist } from "@/lib/types";
import {
  analyserBrevTekst,
  lagreBrev,
  type LagreBrevInput,
} from "./actions";

type KravValg = { id: string; navn: string };

function brevtypeEtikett(bt: BrevType): string {
  return bt === "annet" ? "Annet" : STADIUM_ETIKETT[bt];
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
  const [tekst, setTekst] = useState("");
  const [feil, setFeil] = useState<string | null>(null);
  const [lagrer, setLagrer] = useState(false);

  const [analyse, setAnalyse] = useState<BrevAnalyse | null>(null);
  const [avsender, setAvsender] = useState("");
  const [brevtype, setBrevtype] = useState<BrevType | "">("");
  const [brevdato, setBrevdato] = useState("");
  const [belop, setBelop] = useState("");
  const [kravModus, setKravModus] = useState<"ny" | "eksisterende">(
    forvalgtKrav ? "eksisterende" : krav.length > 0 ? "eksisterende" : "ny",
  );
  const [valgtKrav, setValgtKrav] = useState<string>(
    forvalgtKrav ?? krav[0]?.id ?? "",
  );
  const [avKryss, setAvKryss] = useState<Record<number, boolean>>({});
  const [stegAv, setStegAv] = useState<Record<number, boolean>>({});

  async function lesBrevet() {
    setFeil(null);
    setSteg(2);
    const r = await analyserBrevTekst(tekst);
    if (!r.ok) {
      setFeil(r.feil);
      setSteg(1);
      return;
    }
    setAnalyse(r.analyse);
    setSteg(3);
  }

  async function lagre() {
    if (!analyse) return;
    setLagrer(true);
    setFeil(null);

    const valgteFrister: ForeslattFrist[] = analyse.foreslatte_frister.filter(
      (f, i) => f.forfallsdato && avKryss[i] !== false,
    );
    const valgteSteg = analyse.foreslatte_steg.filter(
      (_, i) => stegAv[i] !== false,
    );
    const belopTall = belop.trim() ? Number(belop.replace(/\s/g, "")) : null;

    const input: LagreBrevInput = {
      krav:
        kravModus === "eksisterende" && valgtKrav
          ? { modus: "eksisterende", sakId: valgtKrav }
          : { modus: "ny", kreditor: avsender },
      avsender,
      brevtype: brevtype || null,
      brevdato,
      belop: belopTall != null && !Number.isNaN(belopTall) ? belopTall : null,
      original_tekst: tekst.trim(),
      forklaring: analyse.forklaring,
      foreslatte_steg: valgteSteg,
      valgteFrister,
    };

    const r = await lagreBrev(input);
    if (!r.ok) {
      setFeil(r.feil);
      setLagrer(false);
      return;
    }
    router.push(`/krav/${r.sakId}`);
    router.refresh();
  }

  const feltKlasse =
    "mt-1.5 w-full rounded-[10px] border-[0.5px] border-strek bg-flate px-3.5 py-2.5 text-sm text-blekk outline-none focus:border-aksent focus-visible:ring-2 focus-visible:ring-aksent/30";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[640px] flex-col px-5 pt-4">
      <button
        type="button"
        aria-label="Avbryt"
        onClick={() => router.back()}
        className="-ml-1 mb-4 flex size-8 items-center justify-center text-dempet transition hover:text-blekk"
      >
        <X className="size-5" aria-hidden />
      </button>

      {steg === 1 && (
        <div className="flex flex-1 flex-col">
          <h1 className="text-[21px] font-medium tracking-[-0.3px] text-blekk">
            Legg til brev
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-dempet">
            Lim inn teksten fra brevet, så leser Medhold det og foreslår hva du
            bør gjøre.
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
            <Primærknapp
              onClick={lesBrevet}
              disabled={tekst.trim().length < 10}
            >
              Les brevet
            </Primærknapp>
          </div>
        </div>
      )}

      {steg === 2 && (
        <div className="flex flex-1 flex-col items-center justify-center pb-16 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-ikon.svg"
            alt=""
            width={48}
            height={48}
            className="animate-pulse"
            aria-hidden
          />
          <p className="mt-4 text-sm text-dempet">Leser brevet</p>
        </div>
      )}

      {steg === 3 && analyse && (
        <div className="flex flex-1 flex-col pb-8">
          <h1 className="text-[21px] font-medium tracking-[-0.3px] text-blekk">
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
          </div>

          <div className="mt-5">
            <p className="text-[13px] font-medium text-blekk">Hører til</p>
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

          {analyse.foreslatte_frister.length > 0 && (
            <div className="mt-5">
              <p className="text-[13px] font-medium text-blekk">
                Foreslåtte frister
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {analyse.foreslatte_frister.map((f, i) => (
                  <label
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-xl border-[0.5px] border-strek bg-flate px-3.5 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-blekk">
                        {f.tittel}
                      </span>
                      {f.forfallsdato ? (
                        <span className="text-xs text-dempet">
                          {formaterKortDato(f.forfallsdato)}
                        </span>
                      ) : (
                        <span className="text-xs text-dempet">
                          ingen dato i brevet
                        </span>
                      )}
                    </span>
                    <input
                      type="checkbox"
                      checked={avKryss[i] !== false && !!f.forfallsdato}
                      disabled={!f.forfallsdato}
                      onChange={(e) =>
                        setAvKryss((s) => ({ ...s, [i]: e.target.checked }))
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
            <Primærknapp onClick={lagre} disabled={lagrer}>
              {lagrer ? "Lagrer …" : "Lagre i tidslinjen"}
            </Primærknapp>
          </div>
        </div>
      )}
    </main>
  );
}
