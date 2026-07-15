import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Skjermramme, Kort } from "@/components/ui";
import { Gebyrsjekk } from "@/components/Gebyrsjekk";
import { formaterKortDato } from "@/lib/dato";
import { STADIUM_ETIKETT, type BrevType } from "@/lib/gjeld";
import type { GebyrsjekkResultat } from "@/lib/gebyr";
import { BrevSamtale } from "./BrevSamtale";

type Melding = { rolle: "bruker" | "assistent"; innhold: string };

function brevtypeEtikett(bt: BrevType | null): string {
  if (!bt || bt === "annet") return "Brev";
  const t = STADIUM_ETIKETT[bt];
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default async function BrevPage({
  params,
}: {
  params: Promise<{ id: string; brevId: string }>;
}) {
  const { id, brevId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  const { data: brev } = await supabase
    .from("brev")
    .select(
      "id, sak_id, avsender, brevtype, brevdato, forklaring, original_tekst, gebyrsjekk",
    )
    .eq("id", brevId)
    .maybeSingle();
  if (!brev || brev.sak_id !== id) notFound();

  const { data: samtaleData } = await supabase
    .from("brev_samtale")
    .select("rolle, innhold")
    .eq("brev_id", brevId)
    .order("opprettet", { ascending: true });

  const samtale = (samtaleData ?? []) as Melding[];
  const tittel = brevtypeEtikett(brev.brevtype as BrevType | null);

  return (
    <Skjermramme className="pt-5">
      <Link
        href={`/krav/${id}`}
        className="mb-3.5 flex items-center gap-1 text-[13px] text-dempet transition hover:text-blekk"
      >
        <ChevronLeft className="size-5" aria-hidden />
        Tilbake
      </Link>

      <h1 className="text-[21px] font-medium tracking-[-0.3px] text-blekk">
        {tittel}
      </h1>
      <p className="mt-0.5 text-[13px] text-dempet">
        {[brev.avsender, brev.brevdato ? formaterKortDato(brev.brevdato) : null]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <Kort className="mt-4">
        <p className="whitespace-pre-line text-sm leading-relaxed text-blekk">
          {brev.forklaring}
        </p>
      </Kort>

      <Gebyrsjekk
        resultat={(brev.gebyrsjekk as GebyrsjekkResultat | null) ?? null}
        className="mt-3"
      />

      <details className="mt-3">
        <summary className="cursor-pointer text-[13px] text-dempet transition hover:text-blekk">
          Vis originalteksten
        </summary>
        <p className="mt-2 whitespace-pre-line rounded-2xl border-[0.5px] border-strek bg-flate p-4 text-[13px] leading-relaxed text-dempet">
          {brev.original_tekst}
        </p>
      </details>

      <div className="mt-6">
        <p className="mb-3 text-[13px] font-medium text-blekk">
          Spør om brevet
        </p>
        <BrevSamtale brevId={brev.id} start={samtale} />
      </div>
    </Skjermramme>
  );
}
