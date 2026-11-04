import { NavLenke as Link } from "@/components/NavLenke";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Skjermramme } from "@/components/ui";
import { Toppstripe } from "@/components/ui/Toppstripe";
import { harPluss } from "@/lib/plan";
import { UTKAST_TYPER, type UtkastType } from "@/lib/types";
import type { GebyrsjekkResultat } from "@/lib/gebyr";
import { beregnAvdrag, type AvdragsForslag } from "@/lib/avdrag";
import { gebyrDifferanse, ubestridtDel } from "@/lib/utkast-prompt";
import { UtkastFlyt } from "./UtkastFlyt";

function erUtkastType(v: string | undefined): v is UtkastType {
  return !!v && (UTKAST_TYPER as readonly string[]).includes(v);
}

export default async function UtkastPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; brev?: string; manedsbelop?: string }>;
}) {
  const { id } = await params;
  const { type, brev: brevParam, manedsbelop } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  // Gating: uten Pluss (og utenfor pilot) → paywall.
  if (!(await harPluss(user.id))) redirect("/pluss");

  const { data: sak } = await supabase
    .from("saker")
    .select("id, kreditor, tittel, saksnummer, belop_totalt")
    .eq("id", id)
    .maybeSingle();
  if (!sak) notFound();

  // Nyeste brev på kravet (grunnlag for utkastet), evt. det oppgitte.
  const { data: brevListe } = await supabase
    .from("brev")
    .select("id, avsender, avsender_epost, brevdato, opprettet, gebyrsjekk, belop")
    .eq("sak_id", id)
    .order("brevdato", { ascending: false, nullsFirst: false })
    .order("opprettet", { ascending: false });

  const brev =
    (brevParam && brevListe?.find((b) => b.id === brevParam)) ||
    brevListe?.[0] ||
    null;

  const gs = (brev?.gebyrsjekk as GebyrsjekkResultat | null) ?? null;
  const harOverGebyr = (gs?.antallOver ?? 0) > 0;
  // Til «Hva er du uenig i?» og betalingsmerknaden (§D.1) — samme rene
  // utregning som prompten bruker.
  const gebyrDiff = gebyrDifferanse(gs);
  const ubestridt = ubestridtDel(sak.belop_totalt ?? brev?.belop ?? null, gs);

  const starttype = erUtkastType(type) ? type : "innsigelse";

  // Navnelinjen i brevet (§6): husket verdi først, ellers profil-fornavnet.
  const meta = user.user_metadata as
    | { brevnavn?: string; fornavn?: string }
    | undefined;
  const navnStart = (meta?.brevnavn?.trim() || meta?.fornavn?.trim()) ?? "";

  // Avdragsforslag fra Veier ut (kun for nedbetalingsavtale, med totalbeløp).
  const manedTall = manedsbelop ? Number(manedsbelop) : NaN;
  const avdrag: AvdragsForslag | null =
    starttype === "nedbetalingsavtale" &&
    sak.belop_totalt != null &&
    sak.belop_totalt > 0 &&
    !Number.isNaN(manedTall) &&
    manedTall >= 1
      ? beregnAvdrag(sak.belop_totalt, manedTall)
      : null;

  return (
    <Skjermramme className="pt-2.5" animerInn={false}>
      <Toppstripe className="mb-1">
        <Link
          href={`/krav/${id}`}
          className="trykk -ml-2.5 flex min-h-11 min-w-0 items-center gap-0.5 pr-2 text-hjelp text-dempet transition hover:text-blekk"
        >
          <ChevronLeft className="size-6 shrink-0 text-blekk" strokeWidth={2} aria-hidden />
          <span className="truncate">{sak.kreditor ?? sak.tittel}</span>
        </Link>
      </Toppstripe>

      <h1 className="tittel-s text-blekk">
        Lag et utkast
      </h1>
      <p className="mt-1.5 text-hjelp leading-relaxed text-dempet">
        Velg type og fyll inn kort. Medhold skriver et utkast du kan endre og
        sende selv.
      </p>

      <div className="mt-6">
        <UtkastFlyt
          sakId={sak.id}
          brevId={brev?.id ?? null}
          avsender={brev?.avsender ?? null}
          avsenderEpost={brev?.avsender_epost ?? null}
          kreditor={sak.kreditor ?? sak.tittel}
          saksnummer={sak.saksnummer ?? null}
          starttype={starttype}
          harOverGebyr={harOverGebyr}
          gebyrDiff={gebyrDiff}
          ubestridt={ubestridt}
          avdrag={avdrag}
          navnStart={navnStart}
        />
      </div>
    </Skjermramme>
  );
}
