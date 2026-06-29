"use client";

import { useActionState, useState, useTransition } from "react";
import { analyserBrev, type AnalyseResultat } from "@/app/saker/ai-actions";
import {
  leggTilForeslattFrist,
  leggTilForeslattSteg,
} from "@/app/saker/frister-steg-actions";
import { formaterDato } from "@/lib/dato";
import type { BrevAnalyse } from "@/lib/types";

export default function AiBrevhjelp({ sakId }: { sakId: string }) {
  const handling = analyserBrev.bind(null, sakId);
  const [resultat, formAction, venter] = useActionState<
    AnalyseResultat | undefined,
    FormData
  >(handling, undefined);

  return (
    <section className="mt-8">
      <h2 className="mb-1 text-lg font-semibold text-slate-900">
        Forstå et brev
      </h2>
      <p className="mb-3 text-sm text-slate-500">
        Lim inn teksten fra et brev eller vedtak, så forklarer vi hva det betyr
        og foreslår neste steg. Bare det du limer inn sendes til AI-en.
      </p>

      <form action={formAction} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
        <textarea
          name="tekst"
          rows={6}
          maxLength={20000}
          placeholder="Lim inn teksten fra brevet her …"
          className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={venter}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {venter ? "Leser brevet …" : "Forklar brevet"}
          </button>
          {venter && (
            <span className="text-sm text-slate-500">
              Dette tar noen sekunder.
            </span>
          )}
        </div>
        {resultat && !resultat.ok && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {resultat.feil}
          </p>
        )}
      </form>

      {resultat?.ok && (
        <Analyse sakId={sakId} analyse={resultat.analyse} />
      )}
    </section>
  );
}

function Analyse({
  sakId,
  analyse,
}: {
  sakId: string;
  analyse: BrevAnalyse;
}) {
  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-900">Forklaring</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
        {analyse.forklaring}
      </p>

      {analyse.foreslatte_steg.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-900">
            Foreslåtte neste steg
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {analyse.foreslatte_steg.map((steg, i) => (
              <LeggTilRad
                key={i}
                tekst={steg}
                handling={() => leggTilForeslattSteg(sakId, steg)}
              />
            ))}
          </ul>
        </div>
      )}

      {analyse.foreslatte_frister.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-900">
            Mulige frister i brevet
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {analyse.foreslatte_frister.map((frist, i) => {
              const harDato = /^\d{4}-\d{2}-\d{2}$/.test(frist.forfallsdato);
              return (
                <LeggTilRad
                  key={i}
                  tekst={
                    harDato
                      ? `${frist.tittel} — ${formaterDato(frist.forfallsdato)}`
                      : `${frist.tittel} (dato uklar — sjekk selv)`
                  }
                  kanLegges={harDato}
                  handling={() =>
                    leggTilForeslattFrist(
                      sakId,
                      frist.tittel,
                      frist.forfallsdato,
                    )
                  }
                />
              );
            })}
          </ul>
        </div>
      )}

      <p className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Dette er hjelp til å få oversikt — ikke profesjonell rådgivning. Bekreft
        viktige ting med rett instans (NAV, lege, advokat, kommune).
      </p>
    </div>
  );
}

function LeggTilRad({
  tekst,
  handling,
  kanLegges = true,
}: {
  tekst: string;
  handling: () => Promise<{ feil?: string }>;
  kanLegges?: boolean;
}) {
  const [venter, startTransition] = useTransition();
  const [lagtTil, setLagtTil] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
      <span className="min-w-0 flex-1 text-sm text-slate-700">{tekst}</span>
      {lagtTil ? (
        <span className="shrink-0 text-sm font-medium text-emerald-600">
          ✓ Lagt til
        </span>
      ) : kanLegges ? (
        <button
          type="button"
          disabled={venter}
          onClick={() =>
            startTransition(async () => {
              const r = await handling();
              if (r.feil) setFeil(r.feil);
              else setLagtTil(true);
            })
          }
          className="shrink-0 rounded-md border border-slate-300 px-2.5 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {venter ? "…" : "Legg til"}
        </button>
      ) : (
        <span className="shrink-0 text-xs text-slate-400">kan ikke legges til</span>
      )}
      {feil && <span className="text-xs text-red-600">{feil}</span>}
    </li>
  );
}
