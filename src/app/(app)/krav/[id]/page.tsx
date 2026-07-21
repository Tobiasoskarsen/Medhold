import { NavLenke as Link } from "@/components/NavLenke";
import { notFound } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Skjermramme,
  Pillknapp,
  Primærknapp,
  Trapp,
  Nedtelling,
  Tidslinje,
  TidslinjeHendelse,
} from "@/components/ui";
import { DomMini } from "@/components/Dom";
import { KravNavn, KravBelop } from "./KravHeader";
import { formaterKortDato } from "@/lib/dato";
import {
  STADIER,
  STADIUM_ETIKETT,
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
import type { HendelseVariant } from "@/components/ui/Tidslinje";
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

/** Total differanse over lovlig sats i et lagret gebyrsjekk-resultat. */
function overTotal(g: GebyrsjekkResultat | null): number {
  if (!g) return 0;
  return g.linjer
    .filter((l) => l.vurdering === "over")
    .reduce((sum, l) => sum + (l.differanse ?? 0), 0);
}

function kr(n: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 2 }).format(n);
}

export default async function KravDetaljPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const varslerPa = user?.user_metadata?.varsler_paa !== false;

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

  // Nærmeste aktive frist totalt (til Nedtelling-kortet).
  const nesteFrist = [...aktiveFrister].sort((a, b) =>
    a.forfallsdato < b.forfallsdato ? -1 : 1,
  )[0];

  const stadium = sak.stadium as Stadium | null;

  const sisteBrev = brevListe[0];
  const overDiff = overTotal(sisteBrev?.gebyrsjekk ?? null);
  const harOverGebyr = overDiff > 0;

  // Dørvalget (§2.1): to likeverdige dører KUN når det ikke er gebyrfunn og
  // stadiet er betalingsoppfordring eller senere. Ved funn er innsigelsen
  // objektivt sterkest → behold CTA + sekundærlenke.
  const senereEnnVarsel =
    stadium != null &&
    STADIER.indexOf(stadium) >= STADIER.indexOf("betalingsoppfordring");
  const toLikeverdigeDorer =
    stotterUtkast(stadium) && !lost && senereEnnVarsel && !harOverGebyr;

  // Navn: hovedkravet i overskriften, inkassoselskapet i eyebrow-en (når det
  // finnes en opprinnelig kreditor, er `kreditor` selve inkassoselskapet).
  const hovednavn = sak.opprinnelig_kreditor ?? sak.kreditor ?? sak.tittel;
  const inkassoselskap = sak.opprinnelig_kreditor ? sak.kreditor : null;
  const eyebrow = [
    stadium ? stor(STADIUM_ETIKETT[stadium]) : null,
    inkassoselskap ? `sak hos ${inkassoselskap}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  type Item = {
    key: string;
    datoISO: string;
    tittel: ReactNode;
    tekst?: string;
    fristPill?: string;
    fremhevet: boolean;
    variant?: HendelseVariant;
    href?: string;
    chip?: string;
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

  // Funn-hendelser: ett per brev med lagret «over»-funn (dom-rød node).
  const funnItems: Item[] = brevListe
    .filter((b) => overTotal(b.gebyrsjekk) > 0)
    .map((b) => ({
      key: `funn-${b.id}`,
      datoISO: b.brevdato ?? b.opprettet.slice(0, 10),
      tittel: (
        <>
          <span className="text-dom-rod">Funn:</span> gebyr over lovlig sats
        </>
      ),
      tekst: `${kr(overTotal(b.gebyrsjekk))} kr over forskriftens maksimum.`,
      fremhevet: false,
      variant: "funn" as const,
    }));

  const løseFristItems: Item[] = aktiveFrister
    .filter((f) => !f.brev_id)
    .map((f) => ({
      key: `frist-${f.id}`,
      datoISO: f.forfallsdato,
      tittel: f.tittel,
      fristPill: fristPillTekst(f),
      fremhevet: true,
    }));

  const utkastItems: Item[] = utkast.map((u) =>
    u.sendt_at
      ? {
          key: `utkast-${u.id}`,
          datoISO: u.sendt_at.slice(0, 10),
          tittel: `${UTKAST_ETIKETT[u.type]} sendt`,
          fremhevet: false,
          chip: varslerPa
            ? "Medhold purrer for deg etter 14 dager"
            : "Husk å følge opp om 14 dager",
        }
      : {
          key: `utkast-${u.id}`,
          datoISO: u.opprettet.slice(0, 10),
          tittel: `Utkast: ${UTKAST_ETIKETT[u.type]}`,
          fremhevet: false,
          ekstra: !lost ? <MarkerSendtKnapp utkastId={u.id} /> : undefined,
        },
  );

  const items = [
    ...brevItems,
    ...funnItems,
    ...løseFristItems,
    ...utkastItems,
  ].sort((a, b) => (a.datoISO < b.datoISO ? 1 : -1));
  if (items[0]) items[0].fremhevet = items[0].variant ? false : true;

  return (
    <Skjermramme className="pt-5">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/krav"
          className="flex items-center gap-1 text-[13px] text-dempet transition hover:text-blekk"
        >
          <ChevronLeft className="size-5" aria-hidden />
          Krav
        </Link>
        <KravMeny kravId={sak.id} lost={lost} />
      </div>

      {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
      <KravNavn
        navn={hovednavn}
        delId={sak.id}
        delNavn={!sak.opprinnelig_kreditor}
      />

      {sak.belop_totalt != null && (
        <p className="mt-2">
          <KravBelop
            verdi={sak.belop_totalt}
            delId={sak.id}
            className="font-serif text-[38px] font-medium tracking-[-0.02em] tabular-nums text-blekk"
          />
        </p>
      )}
      {harOverGebyr && (
        <p className="mt-1 text-[12.5px] font-semibold text-dom-rod">
          {kr(overDiff)} kr av dette er over lovlig sats.
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {sak.status === "venter_pa_svar" && (
          <span
            className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${STATUS_STIL.venter_pa_svar}`}
          >
            {STATUS_ETIKETT.venter_pa_svar}
          </span>
        )}
        {utfall && (
          <span
            className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${UTFALL_STIL[utfall]}`}
          >
            {UTFALL_ETIKETT[utfall]}
          </span>
        )}
      </div>

      {stadium && (
        <div className="mt-5">
          <Trapp stadium={stadium} />
        </div>
      )}

      {nesteFrist && (
        <Nedtelling
          forfallsdato={nesteFrist.forfallsdato}
          tittel={nesteFrist.tittel}
          className="mt-4"
        />
      )}

      {harOverGebyr && sisteBrev?.gebyrsjekk && (
        <DomMini resultat={sisteBrev.gebyrsjekk} className="mt-4" />
      )}

      {stotterUtkast(stadium) &&
        !lost &&
        (toLikeverdigeDorer ? (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Link
              href={`/krav/${sak.id}/utkast?type=innsigelse`}
              className="trykk flex flex-col rounded-2xl border-[0.5px] border-aksent/40 bg-aksent/5 px-4 py-4"
            >
              <span className="text-sm font-semibold text-blekk">
                Jeg er uenig i kravet
              </span>
              <span className="mt-0.5 text-[12px] text-dempet">
                Skriv en innsigelse
              </span>
            </Link>
            <Link
              href={`/krav/${sak.id}/veier-ut`}
              className="trykk flex flex-col rounded-2xl border-[0.5px] border-trygg/40 bg-trygg/5 px-4 py-4"
            >
              <span className="text-sm font-semibold text-blekk">
                Kravet stemmer
              </span>
              <span className="mt-0.5 text-[12px] text-dempet">Se veiene ut</span>
            </Link>
          </div>
        ) : (
          <div className="mt-5">
            <Primærknapp href={`/krav/${sak.id}/utkast?type=innsigelse`}>
              Skriv innsigelsen
            </Primærknapp>
            <p className="mt-1.5 text-center text-[12px] text-dempet">
              Tar bare noen minutter.
            </p>
            <Link
              href={`/krav/${sak.id}/veier-ut`}
              className="trykk mt-3 flex w-full items-center justify-center rounded-[10px] border-[0.5px] border-trygg/40 bg-trygg/5 px-3 py-3 text-sm font-medium text-blekk transition hover:border-trygg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trygg"
            >
              Kravet stemmer — se veiene ut
            </Link>
          </div>
        ))}

      <h2 className="mb-4 mt-8 font-serif text-[19px] font-semibold text-blekk">
        Sakens gang
      </h2>
      <div>
        {items.length === 0 && !lost ? (
          <p className="text-sm text-dempet">
            Ingen hendelser ennå. Legg til det første brevet.
          </p>
        ) : (
          <Tidslinje>
            {lost && (
              <TidslinjeHendelse
                dato={lostDato ? formaterKortDato(lostDato) : ""}
                node={<LostNode sakId={sak.id} utfall={utfall} />}
                sisteHendelse={items.length === 0}
              >
                {(() => {
                  const s =
                    utfall === "medhold" || utfall === "delvis_medhold"
                      ? { tittel: "Medhold — kravet er frafalt", under: null, farge: "text-gull" }
                      : utfall === "nedbetalingsavtale"
                        ? {
                            tittel: "Avtale på plass.",
                            under: "Du har en plan — og saken har en slutt.",
                            farge: "text-trygg",
                          }
                        : utfall === "oppgjort"
                          ? {
                              tittel: "Saken er ute av verden.",
                              under: "Betalt og avsluttet. Godt jobbet.",
                              farge: "text-blekk",
                            }
                          : { tittel: "Sak løst", under: null, farge: "text-blekk" };
                  return (
                    <>
                      <p className={`font-serif text-[16px] font-semibold ${s.farge}`}>
                        {s.tittel}
                      </p>
                      {s.under && (
                        <p className="mt-0.5 text-[13px] text-dempet">{s.under}</p>
                      )}
                    </>
                  );
                })()}
              </TidslinjeHendelse>
            )}
            {items.map((item, i) => {
              const kjerne = (
                <>
                  <p className="text-[14.5px] font-semibold text-blekk">
                    {item.tittel}
                  </p>
                  {item.tekst && (
                    <p className="mt-0.5 text-[13px] leading-snug text-dempet">
                      {item.tekst}
                    </p>
                  )}
                  {item.fristPill && (
                    <span className="mt-1.5 inline-block rounded-full bg-varsel-bg px-2 py-1 text-[11px] font-medium text-varsel-tekst">
                      {item.fristPill}
                    </span>
                  )}
                  {item.chip && (
                    <span className="mt-1.5 inline-block rounded-full bg-aksent/10 px-3 py-1 text-[12px] font-semibold text-aksent-dyp">
                      {item.chip}
                    </span>
                  )}
                </>
              );
              const innhold = item.fremhevet ? (
                <div className="rounded-xl border-[0.5px] border-strek bg-flate px-3.5 py-3">
                  {kjerne}
                </div>
              ) : (
                kjerne
              );
              return (
                <TidslinjeHendelse
                  key={item.key}
                  dato={formaterKortDato(item.datoISO)}
                  fremhevet={item.fremhevet}
                  variant={item.variant}
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

      <div className="my-6 flex justify-center">
        <Pillknapp href={`/legg-til-brev?krav=${sak.id}`}>
          <Plus className="size-4" aria-hidden />
          Legg til brev
        </Pillknapp>
      </div>
    </Skjermramme>
  );
}
