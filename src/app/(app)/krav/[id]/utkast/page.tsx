import { NavLenke as Link } from "@/components/NavLenke";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Skjermramme } from "@/components/ui";
import { harPluss } from "@/lib/plan";
import { UTKAST_TYPER, type UtkastType } from "@/lib/types";
import type { GebyrsjekkResultat } from "@/lib/gebyr";
import { beregnAvdrag, type AvdragsForslag } from "@/lib/avdrag";
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
    .select("id, avsender, avsender_epost, brevdato, opprettet, gebyrsjekk")
    .eq("sak_id", id)
    .order("brevdato", { ascending: false, nullsFirst: false })
    .order("opprettet", { ascending: false });

  const brev =
    (brevParam && brevListe?.find((b) => b.id === brevParam)) ||
    brevListe?.[0] ||
    null;

  const harOverGebyr =
    ((brev?.gebyrsjekk as GebyrsjekkResultat | null)?.antallOver ?? 0) > 0;

  const starttype = erUtkastType(type) ? type : "innsigelse";

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
    <Skjermramme className="pt-5">
      <Link
        href={`/krav/${id}`}
        className="mb-3.5 flex items-center gap-1 text-[13px] text-dempet transition hover:text-blekk"
      >
        <ChevronLeft className="size-5" aria-hidden />
        {sak.kreditor ?? sak.tittel}
      </Link>

      <h1 className="font-serif text-[24px] font-medium tracking-[-0.01em] text-blekk">
        Lag et utkast
      </h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-dempet">
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
          avdrag={avdrag}
        />
      </div>
    </Skjermramme>
  );
}
