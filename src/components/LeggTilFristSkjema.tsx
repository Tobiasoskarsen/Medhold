"use client";

import { useActionState, useEffect, useRef } from "react";
import type { SkjemaResultat } from "@/app/saker/frister-steg-actions";

type Props = {
  handling: (
    forrige: SkjemaResultat,
    formData: FormData,
  ) => Promise<SkjemaResultat>;
};

const inputStil =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900";

export default function LeggTilFristSkjema({ handling }: Props) {
  const [resultat, formAction, venter] = useActionState(handling, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  // Tøm skjemaet etter vellykket lagring (ingen feil returnert).
  useEffect(() => {
    if (!venter && resultat === undefined) formRef.current?.reset();
  }, [venter, resultat]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          name="tittel"
          required
          maxLength={200}
          placeholder="Hva er fristen? F.eks. «Svarfrist klage»"
          className={inputStil}
        />
        <input
          name="forfallsdato"
          type="date"
          required
          className={inputStil}
        />
      </div>
      <input
        name="notat"
        maxLength={2000}
        placeholder="Notat (valgfritt)"
        className={inputStil}
      />
      {resultat?.feil && (
        <p className="text-sm text-red-700">{resultat.feil}</p>
      )}
      <div>
        <button
          type="submit"
          disabled={venter}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {venter ? "Legger til …" : "Legg til frist"}
        </button>
      </div>
    </form>
  );
}
