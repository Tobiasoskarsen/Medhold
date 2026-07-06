import Link from "next/link";
import MalListe from "@/components/MalListe";
import { APP_NAME } from "@/lib/brand";

export const metadata = {
  title: `Kom i gang med en mal — ${APP_NAME}`,
};

export default function MalPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <Link
        href="/saker"
        className="text-sm text-slate-500 transition hover:text-slate-800"
      >
        ← Tilbake til saker
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
        Kom i gang med en mal
      </h1>
      <p className="mt-1 mb-8 text-sm text-slate-500">
        Velg situasjonen som ligner mest på din, så oppretter vi en sak med
        konkrete neste steg du kan ta. Du kan endre alt etterpå.
      </p>

      <MalListe />

      <p className="mt-6 text-xs text-slate-400">
        Malene gir generell veiledning, ikke profesjonell rådgivning. Vi setter
        ingen frister automatisk — dem legger du til selv når du vet datoene.
      </p>
    </div>
  );
}
