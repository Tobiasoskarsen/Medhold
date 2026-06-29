import Link from "next/link";
import SakSkjema from "@/components/SakSkjema";
import { opprettSak } from "@/app/saker/actions";

export default function NySakPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <Link
        href="/saker"
        className="text-sm text-slate-500 transition hover:text-slate-800"
      >
        ← Tilbake til saker
      </Link>

      <h1 className="mt-4 mb-2 text-2xl font-semibold tracking-tight text-slate-900">
        Ny sak
      </h1>
      <p className="mb-8 text-sm text-slate-500">
        Én sak = én tråd å holde styr på. Du kan endre alt senere.
      </p>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <SakSkjema
          handling={opprettSak}
          knappTekst="Opprett sak"
          avbrytHref="/saker"
        />
      </div>
    </div>
  );
}
