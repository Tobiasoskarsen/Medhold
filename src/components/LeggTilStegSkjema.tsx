"use client";

import { useActionState, useEffect, useRef } from "react";
import type { SkjemaResultat } from "@/app/saker/frister-steg-actions";

type Props = {
  handling: (
    forrige: SkjemaResultat,
    formData: FormData,
  ) => Promise<SkjemaResultat>;
};

export default function LeggTilStegSkjema({ handling }: Props) {
  const [resultat, formAction, venter] = useActionState(handling, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!venter && resultat === undefined) formRef.current?.reset();
  }, [venter, resultat]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          name="tekst"
          required
          maxLength={500}
          placeholder="Hva er neste steg? F.eks. «Ring saksbehandler»"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
        />
        <button
          type="submit"
          disabled={venter}
          className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {venter ? "…" : "Legg til"}
        </button>
      </div>
      {resultat?.feil && (
        <p className="text-sm text-red-700">{resultat.feil}</p>
      )}
    </form>
  );
}
