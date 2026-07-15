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
  Belop,
} from "@/components/ui";
import { formaterKortDato } from "@/lib/dato";
import {
  STADIUM_ETIKETT,
  nesteStadium,
  fylteSegmenter,
  stotterUtkast,
  type Stadium,
  type BrevType,
} from "@/lib/gjeld";
import {
  UTKAST_ETIKETT,
  STATUS_ETIKETT,
  STATUS_STIL,
  UTFALL_ETIKETT,
  UTFALL_STIL,
  type FristKilde,
  type UtkastType,
  type SakUtfall,
} from "@/lib/types";
import type { GebyrsjekkResultat } from "@/lib/gebyr";
import type { ReactNode } from "react";
import { KravMeny } from "./KravMeny";
import { LostNode } from "./LostNode";
import { MarkerSendtKnapp } from "./MarkerSendtKnapp";

type BrevRad = {
  id: string;
  brevdato: string | null;
  brevtype: BrevType | null;
  avsender: string | null;
  opprettet: string;
  gebyrsjekk: GebyrsjekkResultat | null;
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
      "id, kreditor, tittel, opprinnelig_kreditor, saksnummer, belop_totalt, stadium, status, utfall, sist_endret",
    )
    .eq("id", id)
    .maybeSingle();

  if (!sak) notFound();

  const lost = sak.status === "fullfort";
  const lostDato = (sak.sist_endret as string | null)?.slice(0, 10);
  const utfall = sak.utfall as SakUtfall | null;

  const [{ data: brevData }, { data: fristData }, { data: utkastData }] =
    await Promise.all([
      supabase
        .from("brev")
        .select("id, brevdato, brevtype, avsender, opprettet, gebyrsjekk")
        .eq("sak_id", id)
        .order("brevdato", { ascending: false, nullsFirst: false })
        .order("opprettet", { ascending: false }),
      supabase
        .from("frister")
        .select("id, tittel, forfallsdato, kilde, brev_id, fullfort")
        .eq("sak_id", id),
      supabase
        .from("utkast")
        .select("id, type, opprettet, sendt_at")
        .eq("sak_id", id),
    ]);

  const brevListe = (brevData ?? []) as BrevRad[];
  const frister = (fristData ?? []) as FristRad[];
  const utkast = (utkastData ?? []) as {
    id: string;
    type: UtkastType;
    opprettet: string;
    sendt_at: string | null;
  }[];
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
  // Konservativt: pillen vises kun ved «over» på nyeste brev, aldri mulig_over.
  const harOverGebyr = (sisteBrev?.gebyrsjekk?.antallOver ?? 0) > 0;

  type Item = {
    key: string;
    datoISO: string;
    tittel: string;
    fristPill?: string;
    fremhevet: boolean;
    href?: string;
    /** Ekstra innhold under hendelsen (f.eks. «Jeg har sendt det»-knapp). */
    ekstra?: ReactNode;
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
      href: `/krav/${id}/brev/${b.id}`,
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

  // Sendte utkast er egne hendelser på sendt-datoen; usendte vises som i dag
  // med en stille «Jeg har sendt det»-rad for bekreftelse i etterkant.
  const utkastItems: Item[] = utkast.map((u) =>
    u.sendt_at
      ? {
          key: `utkast-${u.id}`,
          datoISO: u.sendt_at.slice(0, 10),
          tittel: `${UTKAST_ETIKETT[u.type]} sendt`,
          fremhevet: false,
        }
      : {
          key: `utkast-${u.id}`,
          datoISO: u.opprettet.slice(0, 10),
          tittel: `Utkast: ${UTKAST_ETIKETT[u.type]}`,
          fremhevet: false,
          ekstra: !lost ? <MarkerSendtKnapp utkastId={u.id} /> : undefined,
        },
  );

  const items = [...brevItems, ...løseFristItems, ...utkastItems].sort((a, b) =>
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
        <KravMeny kravId={sak.id} lost={lost} />
      </div>

      <h1 className="text-[21px] font-medium tracking-[-0.3px] text-blekk">
        {sak.kreditor ?? sak.tittel}
      </h1>
      {underlinje && (
        <p className="mt-0.5 text-[13px] text-dempet">{underlinje}</p>
      )}
      {sak.status === "venter_pa_svar" && (
        <span
          className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${STATUS_STIL.venter_pa_svar}`}
        >
          {STATUS_ETIKETT.venter_pa_svar}
        </span>
      )}
      {utfall && (
        <span
          className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${UTFALL_STIL[utfall]}`}
        >
          {UTFALL_ETIKETT[utfall]}
        </span>
      )}
      {harOverGebyr && (
        <span className="mt-2 ml-2 inline-block rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 ring-1 ring-inset ring-red-200">
          Mulig ulovlig gebyr
        </span>
      )}

      {sak.belop_totalt != null && (
        <div className="mt-3.5 flex items-baseline gap-2">
          <Belop
            verdi={sak.belop_totalt}
            className="text-[26px] font-medium tracking-[-0.5px] text-blekk"
          />
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

      {stotterUtkast(stadium) && (
        <Link
          href={`/krav/${sak.id}/utkast`}
          className="mt-4 inline-block text-[13px] font-medium text-aksent transition hover:opacity-80"
        >
          Lag utkast til svar →
        </Link>
      )}

      <div className="mt-6">
        {items.length === 0 && !lost ? (
          <p className="text-sm text-dempet">
            Ingen hendelser ennå. Legg til det første brevet.
          </p>
        ) : (
          <Tidslinje>
            {lost && (
              <TidslinjeHendelse
                dato={lostDato ? formaterKortDato(lostDato) : ""}
                node={<LostNode sakId={sak.id} />}
                sisteHendelse={items.length === 0}
              >
                <p className="text-sm font-medium text-blekk">
                  {utfall === "medhold"
                    ? "Medhold — kravet er frafalt"
                    : "Sak løst"}
                </p>
              </TidslinjeHendelse>
            )}
            {items.map((item, i) => {
              const innhold = item.fremhevet ? (
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
              );
              return (
                <TidslinjeHendelse
                  key={item.key}
                  dato={formaterKortDato(item.datoISO)}
                  fremhevet={item.fremhevet}
                  sisteHendelse={i === items.length - 1}
                >
                  {item.href ? (
                    <Link href={item.href} className="trykk block hover:opacity-80">
                      {innhold}
                    </Link>
                  ) : (
                    innhold
                  )}
                  {item.ekstra}
                </TidslinjeHendelse>
              );
            })}
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
