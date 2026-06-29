import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SakSkjema from "@/components/SakSkjema";
import { oppdaterSak } from "@/app/saker/actions";
import type { Sak } from "@/lib/types";

export default async function RedigerSakPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("saker")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();
  const sak = data as Sak;

  // Bind sak-id til server action slik at skjemaet får (forrige, formData).
  const handling = oppdaterSak.bind(null, sak.id);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <Link
        href={`/saker/${sak.id}`}
        className="text-sm text-slate-500 transition hover:text-slate-800"
      >
        ← Tilbake til saken
      </Link>

      <h1 className="mt-4 mb-8 text-2xl font-semibold tracking-tight text-slate-900">
        Rediger sak
      </h1>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <SakSkjema
          handling={handling}
          sak={sak}
          knappTekst="Lagre endringer"
          avbrytHref={`/saker/${sak.id}`}
        />
      </div>
    </div>
  );
}
