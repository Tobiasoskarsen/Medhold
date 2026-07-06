import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Skjermramme,
  Pillknapp,
  StadiumIndikator,
  Tidslinje,
  TidslinjeHendelse,
} from "@/components/ui";
import { formaterKortDato } from "@/lib/dato";
import { formaterBelop } from "@/lib/format";
import {
  STADIUM_ETIKETT,
  nesteStadium,
  fylteSegmenter,
  type Stadium,
  type BrevType,
} from "@/lib/gjeld";
import type { FristKilde } from "@/lib/types";
import { KravMeny } from "./KravMeny";

type BrevRad = {
  id: string;
  brevdato: string | null;
  brevtype: BrevType | null;
  avsender: string | null;
  opprettet: string;
};

type FristRad = {
  id: string;
  tittel: string;
  forfallsdato: string;
  kilde: FristKilde;
  brev_id: string | null;
  fullfort: boolean;
};

function stor(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function brevtypeEtikett(bt: BrevType | null): string {
  if (!bt || bt === "annet") return "Brev";
  return stor(STADIUM_ETIKETT[bt]);
}

function fristPillTekst(f: FristRad): string {
  const base = `Frist ${formaterKortDato(f.forfallsdato)}`;
  return f.kilde === "beregnet" ? `${base} · beregnet — sjekk brevet` : base;
}

export default async function KravDetaljPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: sak } = await supabase
    .from("saker")
    .select(
      "id, kreditor, tittel, opprinnelig_kreditor, saksnummer, belop_totalt, stadium",
    )
    .eq("id", id)
    .maybeSingle();

  if (!sak) notFound();

  const [{ data: brevData }, { data: fristData }] = await Promise.all([
    supabase
      .from("brev")
      .select("id, brevdato, brevtype, avsender, opprettet")
      .eq("sak_id", id)
      .order("brevdato", { ascending: false, nullsFirst: false })
      .order("opprettet", { ascending: false }),
    supabase
      .from("frister")
      .select("id, tittel, forfallsdato, kilde, brev_id, fullfort")
      .eq("sak_id", id),
  ]);

  const brevListe = (brevData ?? []) as BrevRad[];
  const frister = (fristData ?? []) as FristRad[];
  const aktiveFrister = frister.filter((f) => !f.fullfort);

  // Nærmeste aktive frist per brev (til pillen på brevkortet).
  const fristForBrev = new Map<string, FristRad>();
  for (const f of aktiveFrister) {
    if (!f.brev_id) continue;
    const cur = fristForBrev.get(f.brev_id);
    if (!cur || f.forfallsdato < cur.forfallsdato) fristForBrev.set(f.brev_id, f);
  }

  const stadium = sak.stadium as Stadium | null;
  const neste = stadium ? nesteStadium(stadium) : null;

  const sisteBrev = brevListe[0];
  const sisteBrevDato = sisteBrev?.brevdato ?? sisteBrev?.opprettet.slice(0, 10);
  const belop = formaterBelop(sak.belop_totalt);

  type Item = {
    key: string;
    datoISO: string;
    tittel: string;
    fristPill?: string;
    fremhevet: boolean;
  };

  const brevItems: Item[] = brevListe.map((b) => {
    const datoISO = b.brevdato ?? b.opprettet.slice(0, 10);
    const frist = fristForBrev.get(b.id);
    return {
      key: `brev-${b.id}`,
      datoISO,
      tittel: `${brevtypeEtikett(b.brevtype)} mottatt`,
      fristPill: frist ? fristPillTekst(frist) : undefined,
      fremhevet: !!frist,
    };
  });

  const løseFristItems: Item[] = aktiveFrister
    .filter((f) => !f.brev_id)
    .map((f) => ({
      key: `frist-${f.id}`,
      datoISO: f.forfallsdato,
      tittel: f.tittel,
      fristPill: fristPillTekst(f),
      fremhevet: true,
    }));

  const items = [...brevItems, ...løseFristItems].sort((a, b) =>
    a.datoISO < b.datoISO ? 1 : -1,
  );
  // Nyeste hendelse er alltid fremhevet.
  if (items[0]) items[0].fremhevet = true;

  const underlinje = [
    sak.opprinnelig_kreditor ? `for ${sak.opprinnelig_kreditor}` : null,
    sak.saksnummer ? `sak ${sak.saksnummer}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Skjermramme className="pt-5">
      <div className="mb-3.5 flex items-center justify-between">
        <Link
          href="/krav"
          className="flex items-center gap-1 text-[13px] text-dempet transition hover:text-blekk"
        >
          <ChevronLeft className="size-5" aria-hidden />
          Krav
        </Link>
        <KravMeny kravId={sak.id} />
      </div>

      <h1 className="text-[21px] font-medium tracking-[-0.3px] text-blekk">
        {sak.kreditor ?? sak.tittel}
      </h1>
      {underlinje && (
        <p className="mt-0.5 text-[13px] text-dempet">{underlinje}</p>
      )}

      {belop && (
        <div className="mt-3.5 flex items-baseline gap-2">
          <span className="text-[26px] font-medium tracking-[-0.5px] text-blekk">
            {belop} kr
          </span>
          {sisteBrevDato && (
            <span className="text-xs text-dempet">
              totalt per {formaterKortDato(sisteBrevDato)}
            </span>
          )}
        </div>
      )}

      {stadium && (
        <div className="mt-4">
          <StadiumIndikator
            fylt={fylteSegmenter(stadium)}
            stadium={STADIUM_ETIKETT[stadium]}
            neste={neste ? STADIUM_ETIKETT[neste] : undefined}
          />
        </div>
      )}

      <div className="mt-6">
        {items.length === 0 ? (
          <p className="text-sm text-dempet">
            Ingen hendelser ennå. Legg til det første brevet.
          </p>
        ) : (
          <Tidslinje>
            {items.map((item, i) => (
              <TidslinjeHendelse
                key={item.key}
                dato={formaterKortDato(item.datoISO)}
                fremhevet={item.fremhevet}
                sisteHendelse={i === items.length - 1}
              >
                {item.fremhevet ? (
                  <div className="rounded-xl border-[0.5px] border-strek bg-flate px-3.5 py-3">
                    <p className="text-sm font-medium text-blekk">
                      {item.tittel}
                    </p>
                    {item.fristPill && (
                      <span className="mt-1.5 inline-block rounded-full bg-varsel-bg px-2 py-1 text-[11px] font-medium text-varsel-tekst">
                        {item.fristPill}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-blekk">{item.tittel}</p>
                )}
              </TidslinjeHendelse>
            ))}
          </Tidslinje>
        )}
      </div>

      <div className="my-5 flex justify-center">
        <Pillknapp href={`/legg-til-brev?krav=${sak.id}`}>
          <Plus className="size-4" aria-hidden />
          Legg til brev
        </Pillknapp>
      </div>
    </Skjermramme>
  );
}
