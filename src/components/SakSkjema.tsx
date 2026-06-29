"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  KATEGORI_ETIKETT,
  SAK_KATEGORIER,
  SAK_STATUSER,
  STATUS_ETIKETT,
  type Sak,
} from "@/lib/types";
import type { SakSkjemaResultat } from "@/app/saker/actions";

type Props = {
  handling: (
    forrige: SakSkjemaResultat,
    formData: FormData,
  ) => Promise<SakSkjemaResultat>;
  sak?: Sak;
  knappTekst: string;
  avbrytHref: string;
};

const inputStil =
  "rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900";

export default function SakSkjema({
  handling,
  sak,
  knappTekst,
  avbrytHref,
}: Props) {
  const [resultat, formAction, venter] = useActionState(handling, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-slate-700">Tittel</span>
        <input
          name="tittel"
          required
          maxLength={200}
          defaultValue={sak?.tittel ?? ""}
          placeholder="F.eks. «Søknad om sykepenger»"
          className={inputStil}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-slate-700">
          Beskrivelse{" "}
          <span className="font-normal text-slate-400">(valgfritt)</span>
        </span>
        <textarea
          name="beskrivelse"
          rows={4}
          maxLength={5000}
          defaultValue={sak?.beskrivelse ?? ""}
          placeholder="Kort om hva denne saken handler om."
          className={`${inputStil} resize-y`}
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-700">Kategori</span>
          <select
            name="kategori"
            defaultValue={sak?.kategori ?? "annet"}
            className={inputStil}
          >
            {SAK_KATEGORIER.map((k) => (
              <option key={k} value={k}>
                {KATEGORI_ETIKETT[k]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-700">Status</span>
          <select
            name="status"
            defaultValue={sak?.status ?? "aktiv"}
            className={inputStil}
          >
            {SAK_STATUSER.map((s) => (
              <option key={s} value={s}>
                {STATUS_ETIKETT[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {resultat?.feil && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {resultat.feil}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={venter}
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {venter ? "Lagrer …" : knappTekst}
        </button>
        <Link
          href={avbrytHref}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          Avbryt
        </Link>
      </div>
    </form>
  );
}
