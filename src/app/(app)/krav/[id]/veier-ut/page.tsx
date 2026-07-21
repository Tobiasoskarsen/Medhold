import { NavLenke as Link } from "@/components/NavLenke";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Skjermramme } from "@/components/ui";
import { formaterBelop } from "@/lib/format";
import { VeierUtFlyt } from "./VeierUtFlyt";

export default async function VeierUtPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  const { data: sak } = await supabase
    .from("saker")
    .select("id, kreditor, tittel, belop_totalt")
    .eq("id", id)
    .maybeSingle();
  if (!sak) notFound();

  const { data: brevListe } = await supabase
    .from("brev")
    .select("id")
    .eq("sak_id", id)
    .order("brevdato", { ascending: false, nullsFirst: false })
    .order("opprettet", { ascending: false })
    .limit(1);
  const brevId = brevListe?.[0]?.id ?? null;

  const kreditor = sak.kreditor ?? sak.tittel;
  const belop = formaterBelop(sak.belop_totalt);
  const eyebrow = [kreditor, belop ? `${belop} kr` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Skjermramme className="pt-5">
      <Link
        href={`/krav/${id}`}
        className="mb-3.5 flex items-center gap-1 text-[13px] text-dempet transition hover:text-blekk"
      >
        <ChevronLeft className="size-5" aria-hidden />
        {kreditor}
      </Link>

      <p className="eyebrow mb-1">{eyebrow}</p>
      <h1 className="font-serif text-[26px] font-medium leading-[1.15] tracking-[-0.01em] text-blekk">
        Kravet stemmer. Her er veiene ut.
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-dempet">
        Alle tre er helt vanlige. Det viktigste er å velge én — og gi beskjed før
        fristen.
      </p>

      <VeierUtFlyt
        sakId={sak.id}
        brevId={brevId}
        total={sak.belop_totalt}
      />
    </Skjermramme>
  );
}
