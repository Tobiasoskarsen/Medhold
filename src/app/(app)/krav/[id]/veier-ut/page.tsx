import { LagretBrevMerknad } from "@/components/LagretBrevMerknad";
import { NavLenke as Link } from "@/components/NavLenke";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Skjermramme, Sekvens, SekvensDel } from "@/components/ui";
import { kr } from "@/lib/gebyrfunn-visning";
import { VeierUtFlyt } from "./VeierUtFlyt";

export default async function VeierUtPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ brev?: string; lagret?: string }>;
}) {
  const { id } = await params;
  const { brev: brevParam, lagret } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  const { data: sak } = await supabase
    .from("saker")
    .select("id, kreditor, tittel, belop_totalt, sist_endret")
    .eq("id", id)
    .maybeSingle();
  if (!sak) notFound();

  let brevSpørring = supabase.from("brev").select("id").eq("sak_id", id).eq("bruker_id", user.id);
  if (brevParam) brevSpørring = brevSpørring.eq("id", brevParam);
  const { data: brevListe, error: brevFeil } = await brevSpørring
    .order("brevdato", { ascending: false, nullsFirst: false })
    .order("opprettet", { ascending: false }).limit(1);
  if (brevParam && (brevFeil || !brevListe?.[0])) notFound();
  const brevId = brevListe?.[0]?.id ?? null;

  const kreditor = sak.kreditor ?? sak.tittel;
  const belop = sak.belop_totalt == null ? null : kr(sak.belop_totalt);
  const eyebrow = [kreditor, belop ? `${belop} kr` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Skjermramme className="pt-5" animerInn={false}>
      {brevId && lagret === brevId && <LagretBrevMerknad sakId={id} brevId={brevId} />}
      <Link
        href={`/krav/${id}`}
        className="mb-3.5 flex items-center gap-1 text-hjelp text-dempet transition hover:text-blekk"
      >
        <ChevronLeft className="size-5" aria-hidden />
        {kreditor}
      </Link>

      <Sekvens>
      <SekvensDel>
      <p className="eyebrow mb-1">{eyebrow}</p>
      <h1 className="tittel-s text-blekk">
        Veiene ut
      </h1>
      <p className="mt-2 text-hjelp leading-relaxed text-dempet">
        Tre helt vanlige måter å håndtere et krav på. Det viktigste er å
        velge én — og gi beskjed før fristen.
      </p>
      </SekvensDel>

      <SekvensDel>
        <VeierUtFlyt
          sakId={sak.id}
          brevId={brevId}
          total={sak.belop_totalt}
          sistEndret={sak.sist_endret as string}
        />
        <p className="mt-4 text-meta text-dempet">
          Generell veiledning — ikke profesjonell rådgivning. Bekreft viktige
          ting med rett instans.
        </p>
      </SekvensDel>
      </Sekvens>
    </Skjermramme>
  );
}
