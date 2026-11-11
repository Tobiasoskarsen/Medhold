import { LagretBrevMerknad } from "@/components/LagretBrevMerknad";
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
import type { VaktFakta } from "@/lib/utkast-vakt";
import { velgUtkastbrev } from "@/lib/utkastgrunnlag";
import { sumavvikFra } from "@/lib/sumkontroll";

function erUtkastType(v: string | undefined): v is UtkastType {
  return !!v && (UTKAST_TYPER as readonly string[]).includes(v);
}

export default async function UtkastPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; brev?: string; manedsbelop?: string; utkast?: string; lagret?: string }>;
}) {
  const { id } = await params;
  const { type, brev: brevParam, manedsbelop, utkast: utkastParam, lagret } = await searchParams;

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
    .eq("bruker_id", user.id)
    .maybeSingle();
  if (!sak) notFound();
  const { data: utkastListe, error: utkastFeil } = await supabase.from("utkast")
    .select("id, type, brev_id, innhold, versjon, sendt_at, sendt_innhold, vakt_fakta")
    .eq("sak_id", id).eq("bruker_id", user.id).order("opprettet", { ascending: false });
  const valgtUtkast = utkastParam ? utkastListe?.find((u) => u.id === utkastParam) : undefined;
  if (utkastParam && !valgtUtkast && !utkastFeil) notFound();

  // Nyeste brev på kravet (grunnlag for utkastet), evt. det oppgitte.
  const { data: brevListe } = await supabase
    .from("brev")
    .select("id, avsender, avsender_epost, brevdato, opprettet, gebyrsjekk, belop")
    .eq("sak_id", id)
    .eq("bruker_id", user.id)
    .order("brevdato", { ascending: false, nullsFirst: false })
    .order("opprettet", { ascending: false });

  const { brev, utilgjengelig } = velgUtkastbrev(brevListe ?? [], valgtUtkast, brevParam);
  if (utilgjengelig || (utkastParam && utkastFeil)) {
    return <Skjermramme><h1 className="tittel-s">Dokumentgrunnlaget er utilgjengelig</h1>
      <p role="alert">Vi kan ikke bekrefte det opprinnelige brevet. Ingen andre brev er valgt i stedet. Åpne saken og kontroller grunnlaget før du sender.</p>
      {valgtUtkast && <pre className="mt-4 whitespace-pre-wrap break-words">{valgtUtkast.sendt_innhold ?? valgtUtkast.innhold}</pre>}
      <Link href={`/krav/${id}`}>Tilbake til saken</Link></Skjermramme>;
  }

  const gs = (brev?.gebyrsjekk as GebyrsjekkResultat | null) ?? null;
  const harOverGebyr = (gs?.antallOver ?? 0) > 0;
  // Til «Hva er du uenig i?» og betalingsmerknaden (§D.1) — samme rene
  // utregning som prompten bruker.
  const gebyrDiff = gebyrDifferanse(gs);
  // Sumavvik (Del B.4): brevet krever mer enn hovedstol og kostnader blir.
  const sumDiff = sumavvikFra(gs)?.differanse ?? 0;
  const ubestridt = ubestridtDel(valgtUtkast ? brev?.belop ?? null : sak.belop_totalt ?? brev?.belop ?? null, gs);

  const starttype = erUtkastType(valgtUtkast?.type) ? valgtUtkast.type : erUtkastType(type) ? type : "innsigelse";

  // Navnelinjen i brevet (§6): husket verdi først, ellers profil-fornavnet.
  const meta = user.user_metadata as
    | { brevnavn?: string; fornavn?: string }
    | undefined;
  const navnStart = (meta?.brevnavn?.trim() || meta?.fornavn?.trim()) ?? "";

  // Avdragsforslag fra Veier ut (kun for nedbetalingsavtale, med totalbeløp).
  const manedTall = manedsbelop ? Number(manedsbelop) : NaN;
  const avdrag: AvdragsForslag | null =
    !valgtUtkast && starttype === "nedbetalingsavtale" &&
    sak.belop_totalt != null &&
    sak.belop_totalt > 0 &&
    !Number.isNaN(manedTall) &&
    manedTall >= 1
      ? beregnAvdrag(sak.belop_totalt, manedTall)
      : null;

  return (
    <Skjermramme className="pt-2.5" animerInn={false}>
      {brev && lagret === brev.id && <LagretBrevMerknad sakId={id} brevId={brev.id} />}
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
        Fyll inn kort, så lager Medhold et utkast du kan redigere. Du sender
        brevet selv.
      </p>

      <div className="mt-6">
        <UtkastFlyt
          eierId={user.id}
          key={valgtUtkast?.id ?? "nytt"}
          lagret={valgtUtkast ? { ...valgtUtkast, vakt_fakta: valgtUtkast.vakt_fakta as VaktFakta | null } : undefined}
          sakId={sak.id}
          brevId={brev?.id ?? null}
          avsender={brev?.avsender ?? null}
          avsenderEpost={brev?.avsender_epost ?? null}
          kreditor={sak.kreditor ?? sak.tittel}
          saksnummer={valgtUtkast ? null : sak.saksnummer ?? null}
          starttype={starttype}
          typeValgt={!!valgtUtkast || erUtkastType(type)}
          harOverGebyr={harOverGebyr}
          gebyrDiff={gebyrDiff}
          sumDiff={sumDiff}
          ubestridt={ubestridt}
          avdrag={avdrag}
          navnStart={navnStart}
        />
        {utkastFeil && <p role="alert">Kunne ikke hente lagrede utkast. Prøv igjen før du lager et nytt.</p>}
        {!!utkastListe?.length && <section className="mt-6"><h2 className="seksjonstittel">Lagrede utkast</h2><ul>
          {utkastListe.map((u) => <li key={u.id}><Link className="trykk inline-block min-h-11 underline py-2" href={`/krav/${id}/utkast?utkast=${u.id}`}>
            {u.type} – {u.sendt_at ? "Registrert sendt" : "Åpne og rediger"}
          </Link></li>)}
        </ul></section>}
      </div>
    </Skjermramme>
  );
}
