import { NavLenke as Link } from "@/components/NavLenke";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Skjermramme, Kort, Sekvens, SekvensDel } from "@/components/ui";
import { Gebyrsjekk } from "@/components/Gebyrsjekk";
import { AnnotertBrev } from "@/components/AnnotertBrev";
import { formaterKortDato } from "@/lib/dato";
import { FORKLARING_DISCLAIMER } from "@/lib/brand";
import {
  STADIUM_ETIKETT,
  stotterUtkast,
  type BrevType,
  type Stadium,
} from "@/lib/gjeld";
import type { GebyrsjekkResultat, Kostnadslinje } from "@/lib/gebyr";
import { finnAnnoteringer } from "@/lib/annotering";
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
      "id, sak_id, avsender, brevtype, brevdato, belop, forklaring, original_tekst, gebyrsjekk, kostnadslinjer",
    )
    .eq("id", brevId)
    .maybeSingle();
  if (!brev || brev.sak_id !== id) notFound();

  const [{ data: samtaleData }, { data: sak }, { data: fristData }] =
    await Promise.all([
      supabase
        .from("brev_samtale")
        .select("rolle, innhold")
        .eq("brev_id", brevId)
        .order("opprettet", { ascending: true }),
      supabase.from("saker").select("stadium").eq("id", id).maybeSingle(),
      supabase
        .from("frister")
        .select("tittel, forfallsdato")
        .eq("brev_id", brevId),
    ]);

  const samtale = (samtaleData ?? []) as Melding[];
  const tittel = brevtypeEtikett(brev.brevtype as BrevType | null);
  const stadium = (sak?.stadium as Stadium | null) ?? null;
  // «Bruk funnet i innsigelsen» vises kun når stadiet støtter utkast.
  const utkastHref = stotterUtkast(stadium)
    ? `/krav/${id}/utkast?type=innsigelse&brev=${brevId}`
    : undefined;

  // Annotert brev (§4): rent tekstsøk mot verdier appen allerede har lagret.
  // `hovedstol` er ikke en egen kolonne på brev (guardrail 4 — se
  // PROSJEKT_STATUS «Valg tatt underveis»), så kun totalbeløpet (`belop`)
  // kan annoteres som beløp her.
  const annoteringer = finnAnnoteringer(
    brev.original_tekst,
    (brev.kostnadslinjer as Kostnadslinje[] | null) ?? [],
    (brev.gebyrsjekk as GebyrsjekkResultat | null) ?? null,
    null,
    brev.belop,
    (fristData ?? []) as { tittel: string; forfallsdato: string }[],
  );

  return (
    <Skjermramme className="pt-5" animerInn={false}>
      <Link
        href={`/krav/${id}`}
        className="mb-3.5 flex items-center gap-1 text-[13px] text-dempet transition hover:text-blekk"
      >
        <ChevronLeft className="size-5" aria-hidden />
        Tilbake
      </Link>

      <Sekvens>
      <SekvensDel>
      <h1 className="font-serif text-[24px] font-medium tracking-[-0.01em] text-blekk">
        {tittel}
      </h1>
      <p className="mt-0.5 text-[13px] text-dempet">
        {[brev.avsender, brev.brevdato ? formaterKortDato(brev.brevdato) : null]
          .filter(Boolean)
          .join(" · ")}
      </p>
      </SekvensDel>

      <SekvensDel>
      <Kort className="mt-4">
        <p className="whitespace-pre-line text-sm leading-relaxed text-blekk">
          {brev.forklaring}
        </p>
      </Kort>
      <p className="mt-1.5 text-[12px] text-dempet">{FORKLARING_DISCLAIMER}</p>
      </SekvensDel>

      <SekvensDel>
      <Gebyrsjekk
        resultat={(brev.gebyrsjekk as GebyrsjekkResultat | null) ?? null}
        utkastHref={utkastHref}
        className="mt-3"
      />
      </SekvensDel>

      <SekvensDel>
      <details className="mt-3">
        <summary className="cursor-pointer text-[13px] text-dempet transition hover:text-blekk">
          Vis originalteksten
        </summary>
        <div className="mt-2">
          <AnnotertBrev
            tekst={brev.original_tekst}
            annoteringer={annoteringer}
            className="rounded-2xl border-[0.5px] border-strek bg-flate p-4 text-[13px] leading-relaxed text-dempet"
          />
        </div>
      </details>
      </SekvensDel>

      <SekvensDel>
      <div className="mt-6">
        <p className="mb-3 text-[13px] font-medium text-blekk">
          Spør om brevet
        </p>
        <BrevSamtale brevId={brev.id} start={samtale} />
      </div>
      </SekvensDel>
      </Sekvens>
    </Skjermramme>
  );
}
