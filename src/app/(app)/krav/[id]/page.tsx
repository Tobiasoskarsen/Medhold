import { NavLenke as Link } from "@/components/NavLenke";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, FileText, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Skjermramme,
  Kort,
  Primærknapp,
  StadiumLinje,
  FristRad,
  Tidslinje,
  TidslinjeHendelse,
  Sekvens,
  SekvensDel,
} from "@/components/ui";
import { VenterPaSvarUtvidelse } from "./VenterPaSvarUtvidelse";
import { DomMini, DomMiniFrist, FunnListe } from "@/components/Dom";
import { Veivalg } from "@/components/Veivalg";
import { Alvorsvarsel } from "@/components/Alvorsvarsel";
import { Utregning } from "@/components/Utregning";
import { HovedstolVarsel } from "@/components/HovedstolVarsel";
import type { HovedstolAvvik } from "@/lib/hovedstol-konsistens";
import { KravNavn, KravBelop } from "./KravHeader";
import {
  formaterKortDato,
  formaterDato,
  formaterDagManed,
  idagOslo,
} from "@/lib/dato";
import {
  STADIUM_ETIKETT,
  stotterUtkast,
  leggTilDager,
  LOVBESTEMT_FRIST_DAGER,
  FRIST_HJEMMEL,
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
  type SakStatus,
  type SakUtfall,
} from "@/lib/types";
import type { GebyrsjekkResultat } from "@/lib/gebyr";
import {
  brevAlderDager,
  erGammeltBrev,
  type FristSammenligning,
} from "@/lib/frist";
import { GammeltBrevKort } from "./GammeltBrevKort";
import { finnFraser } from "@/lib/tekstsok";
import { ALVORLIGE_SIGNALER } from "@/lib/alvorsgrense";
import {
  dagerTilOppfolging,
  oppfolgingTilstand,
  OPPFOLGING_DAGER_GRENSE,
  type OppfolgingTilstand,
} from "@/lib/oppfolging";
import type { HendelseVariant } from "@/components/ui/Tidslinje";
import type { ReactNode } from "react";
import { KravMeny } from "./KravMeny";
import { Toppstripe } from "@/components/ui/Toppstripe";
import { LostNode } from "./LostNode";
import { MarkerSendtKnapp } from "./MarkerSendtKnapp";
import { SakensGangSeksjon } from "./SakensGangSeksjon";
import { FristKnapp } from "./FristKnapp";
import { relevantFrist } from "@/lib/prioritet";
import { gjeldendeUtfall, utfallVisning } from "@/lib/utfall";
import { fristStatus } from "@/lib/saksstatus";

type BrevRad = {
  id: string;
  brevdato: string | null;
  brevtype: BrevType | null;
  avsender: string | null;
  opprettet: string;
  gebyrsjekk: GebyrsjekkResultat | null;
  fristfunn: FristSammenligning | null;
  alvorlig: boolean;
  original_tekst: string;
};

type FristRad = {
  id: string;
  tittel: string;
  forfallsdato: string;
  kilde: FristKilde;
  brev_id: string | null;
  fullfort: boolean;
  fullfort_at: string | null;
  erstattet_at: string | null;
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

/**
 * Ventetid som synlig aktivitet (§5), langform (krav-detalj). Er
 * e-postpåminnelser av, loves ingen e-post appen ikke sender — teksten blir
 * «Følg opp selv …» i stedet.
 */
function oppfolgingTekst(
  tilstand: OppfolgingTilstand,
  navn: string | null,
  varslerPa: boolean,
): string {
  switch (tilstand.type) {
    case "kommer":
      return varslerPa
        ? `Vi minner deg på å følge opp${navn ? ` ${navn}` : ""} om ${tilstand.dager} dager`
        : `Følg opp selv om ${tilstand.dager} dager`;
    case "i_dag":
      return varslerPa ? "Vi minner deg på å følge opp i dag" : "Følg opp selv i dag";
    case "sendt":
      return "Påminnelsen er sendt til deg";
    case "na":
      return varslerPa ? "Vi sender deg en påminnelse snart" : "Følg opp selv nå";
  }
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
      "id, kreditor, tittel, opprinnelig_kreditor, saksnummer, belop_totalt, stadium, status, utfall, sist_endret, hovedstol_avvik",
    )
    .eq("id", id)
    .maybeSingle();

  if (!sak) notFound();

  const hovedstolAvvik = (sak.hovedstol_avvik as HovedstolAvvik[] | null) ?? [];

  const lost = sak.status === "fullfort";
  const lostDato = (sak.sist_endret as string | null)?.slice(0, 10);
  const utfall = sak.utfall as SakUtfall | null;
  // Et bevart medhold på en åpnet sak er historikk, ikke sakens status.
  const utfallNa = gjeldendeUtfall(sak.status as SakStatus, utfall);

  const [{ data: brevData }, { data: fristData }, { data: utkastData }] =
    await Promise.all([
      supabase
        .from("brev")
        .select(
          "id, brevdato, brevtype, avsender, opprettet, gebyrsjekk, fristfunn, alvorlig, original_tekst",
        )
        .eq("sak_id", id)
        .order("brevdato", { ascending: false, nullsFirst: false })
        .order("opprettet", { ascending: false }),
      supabase
        .from("frister")
        .select("id, tittel, forfallsdato, kilde, brev_id, fullfort, fullfort_at, erstattet_at")
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

  // Sakens viktigste aktive frist: samme regel som Hjem, så en gammel utløpt
  // frist ikke står over en ny. En avsluttet sak viser ingen frist.
  const idag = idagOslo();
  const nesteFrist = lost
    ? undefined
    : relevantFrist(
        aktiveFrister,
        brevListe.map((b) => ({ ...b, sak_id: id })),
        idag,
      )?.frist;

  // Brevet en BEREGNET frist stammer fra — til «Hvordan regnet vi dette ut»
  // under Nedtellingen (§3.3). Kun relevant når kilde === 'beregnet'.
  const nesteFristBrev = nesteFrist?.brev_id
    ? brevListe.find((b) => b.id === nesteFrist.brev_id)
    : undefined;

  // Ventetid som synlig aktivitet (§5) — kun for saker i «venter på svar».
  // Siste aktivitet = nyeste av (utkast.sendt_at, brev.opprettet), samme
  // definisjon som cron-en (kjorOppfolging) bruker.
  let oppfolgingTilstandVerdi: OppfolgingTilstand | null = null;
  let oppfolgingsdato: string | null = null;
  if (sak.status === "venter_pa_svar") {
    const aktivitetsdatoer = [
      ...utkast.filter((u) => u.sendt_at).map((u) => u.sendt_at as string),
      ...brevListe.map((b) => b.opprettet),
    ];
    const sisteAktivitet = aktivitetsdatoer.sort().at(-1);
    if (sisteAktivitet) {
      const { data: oppfolging } = await supabase
        .from("sendte_oppfolginger")
        .select("sak_id")
        .eq("sak_id", id)
        .maybeSingle();
      oppfolgingTilstandVerdi = oppfolgingTilstand(
        dagerTilOppfolging(sisteAktivitet, new Date()),
        !!oppfolging,
      );
      oppfolgingsdato = leggTilDager(
        sisteAktivitet.slice(0, 10),
        OPPFOLGING_DAGER_GRENSE,
      );
    }
  }

  const stadium = sak.stadium as Stadium | null;

  const sisteBrev = brevListe[0];
  const overDiff = overTotal(sisteBrev?.gebyrsjekk ?? null);
  const harOverGebyr = overDiff > 0;

  // Alvorsgrense (§B.4): MED FORRANG over Veivalg, uansett stadium. Signalordet
  // som faktisk trigget den lagrede `alvorlig`-verdien slås opp på nytt fra
  // samme (lagrede) brevtekst — kun for VISNING, den lagrede boolean-en er og
  // forblir sannheten.
  const erSakAlvorlig = sisteBrev?.alvorlig ?? false;
  const signalord = erSakAlvorlig
    ? (finnFraser(sisteBrev.original_tekst, ALVORLIGE_SIGNALER)[0] ??
      "et alvorlig signal")
    : null;

  // Fristfunn (§A.3): gebyrfunn har alltid forrang i rødnoten under beløpet.
  const harFristfunn =
    sisteBrev?.fristfunn?.status === "avvik_kortere" &&
    !!sisteBrev.fristfunn.beregnetDato;

  // Gamle brev (MEDHOLD_SIKKERHET_ARBEIDSORDRE §C.2): er nyeste brev i en
  // aktiv sak over 45 dager gammelt, er funnene historikk, og brukeren bes
  // legge til det nyeste brevet.
  const sisteBrevGammelt =
    sak.status === "aktiv" &&
    !!sisteBrev &&
    erGammeltBrev(sisteBrev.brevdato, sisteBrev.opprettet, idag);
  const sisteBrevDato = sisteBrev
    ? (sisteBrev.brevdato ?? sisteBrev.opprettet.slice(0, 10))
    : null;
  const fristBrevGammelt =
    !!nesteFristBrev &&
    erGammeltBrev(nesteFristBrev.brevdato, nesteFristBrev.opprettet, idag);

  // Navn: hovedkravet i overskriften, inkassoselskapet over den (når det
  // finnes en opprinnelig kreditor, er `kreditor` selve inkassoselskapet).
  const hovednavn = sak.opprinnelig_kreditor ?? sak.kreditor ?? sak.tittel;
  const inkassoselskap = sak.opprinnelig_kreditor ? sak.kreditor : null;

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
      ekstra:
        frist && !lost ? <FristKnapp fristId={frist.id} handling="fullfort" /> : undefined,
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
      ekstra: !lost ? <FristKnapp fristId={f.id} handling="fullfort" /> : undefined,
    }));

  // Lukkede frister blir stående i historikken, med mulighet til å angre.
  const lukketFristItems: Item[] = frister
    .filter((f) => f.fullfort)
    .map((f) => {
      const erstattet = fristStatus(f) === "erstattet";
      const tidspunkt = erstattet ? f.erstattet_at : f.fullfort_at;
      return {
        key: `frist-lukket-${f.id}`,
        datoISO: tidspunkt?.slice(0, 10) ?? f.forfallsdato,
        tittel: erstattet ? `${f.tittel}: erstattet av nytt brev` : `${f.tittel}: fullført`,
        tekst: `Fristen var ${formaterKortDato(f.forfallsdato)}.`,
        fremhevet: false,
        ekstra: !lost ? <FristKnapp fristId={f.id} handling="aktiv" /> : undefined,
      };
    });

  const utkastItems: Item[] = utkast.map((u) =>
    u.sendt_at
      ? {
          // Ventetiden vises nå som en egen, levende hendelse øverst i
          // tidslinjen (oppfolgingTilstandVerdi, §5) i stedet for en statisk
          // chip her — unngår at de to sier ulike/utdaterte ting.
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

  const items = [
    ...brevItems,
    ...funnItems,
    ...løseFristItems,
    ...lukketFristItems,
    ...utkastItems,
  ].sort((a, b) => (a.datoISO < b.datoISO ? 1 : -1));
  if (items[0]) items[0].fremhevet = items[0].variant ? false : true;

  // Sakens gang: de to nyeste hendelsene er alltid synlige (§2C).
  const hendelser: ReactNode[] = [
    oppfolgingTilstandVerdi && (
      <TidslinjeHendelse
        key="oppfolging"
        dato={oppfolgingsdato ? formaterKortDato(oppfolgingsdato) : ""}
        variant="venter"
        sisteHendelse={items.length === 0}
      >
        <p className="text-[14.5px] font-semibold text-blekk">
          {oppfolgingTekst(
            oppfolgingTilstandVerdi,
            inkassoselskap ?? sak.kreditor ?? sak.tittel,
            varslerPa,
          )}
        </p>
      </TidslinjeHendelse>
    ),
    lost && (
      <TidslinjeHendelse
        key="lost"
        dato={lostDato ? formaterKortDato(lostDato) : ""}
        node={<LostNode sakId={sak.id} utfall={utfall} />}
        sisteHendelse={items.length === 0}
      >
        {(() => {
          // Én tekstkilde per utfall (lib/utfall.ts): bare medhold sier frafalt.
          const s = utfallVisning(utfall, true);
          return (
            <>
              <p className={`text-[16px] font-bold ${s.farge}`}>
                {s.tittel}
              </p>
              {s.under && (
                <p className="mt-0.5 text-hjelp text-dempet">{s.under}</p>
              )}
            </>
          );
        })()}
      </TidslinjeHendelse>
    ),
    ...items.map((item, i) => {
      const kjerne = (
        <>
          <p className="text-[14.5px] font-semibold text-blekk">
            {item.tittel}
          </p>
          {item.tekst && (
            <p className="mt-0.5 text-hjelp leading-snug text-dempet">
              {item.tekst}
            </p>
          )}
          {item.fristPill && (
            <span className="mt-1.5 inline-block rounded-full bg-varsel-bg px-2 py-1 text-[11px] font-medium text-varsel-tekst">
              {item.fristPill}
            </span>
          )}
          {item.chip && (
            <span className="mt-1.5 inline-block rounded-full bg-aksent/10 px-3 py-1 text-meta font-semibold text-aksent-dyp">
              {item.chip}
            </span>
          )}
        </>
      );
      const innhold = item.fremhevet ? (
        <div className="rounded-kontroll border-[0.5px] border-strek bg-flate px-3.5 py-3">
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
    }),
  ].filter(Boolean);
  const FORHAND = 2;

  const harFunnListe =
    (harOverGebyr && !!sisteBrev?.gebyrsjekk) ||
    (harFristfunn && !!sisteBrev?.fristfunn) ||
    hovedstolAvvik.length > 0;

  return (
    <Skjermramme className="pt-2.5" animerInn={false}>
      <Toppstripe className="mb-1">
        <Link
          href="/krav"
          aria-label="Tilbake til saker"
          className="trykk -ml-2.5 flex size-11 items-center justify-center text-blekk"
        >
          <ChevronLeft className="size-6" strokeWidth={2} aria-hidden />
        </Link>
        <KravMeny kravId={sak.id} lost={lost} utfall={utfall} />
      </Toppstripe>

      <Sekvens>
      {/* Kreditor, beløp og status. */}
      <SekvensDel>
      {inkassoselskap && (
        <p className="text-hjelp font-medium text-dempet">Sak hos {inkassoselskap}</p>
      )}
      <KravNavn
        navn={hovednavn}
        delId={sak.id}
        delNavn={!sak.opprinnelig_kreditor}
      />

      {sak.belop_totalt != null && (
        <p className="mt-1">
          <KravBelop
            verdi={sak.belop_totalt}
            delId={sak.id}
            className="tall-xl text-blekk"
          />
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {stadium && <StadiumLinje stadium={stadium} />}
        {sak.status === "venter_pa_svar" && (
          <span
            className={`inline-block rounded-full px-2.5 py-1 text-meta font-medium ring-1 ring-inset ${STATUS_STIL.venter_pa_svar}`}
          >
            {STATUS_ETIKETT.venter_pa_svar}
          </span>
        )}
        {utfallNa && (
          <span
            className={`inline-block rounded-full px-2.5 py-1 text-meta font-medium ring-1 ring-inset ${UTFALL_STIL[utfallNa]}`}
          >
            {UTFALL_ETIKETT[utfallNa]}
          </span>
        )}
      </div>
      {utfall && !lost && utfallVisning(utfall, false).under && (
        <p className="mt-2 text-hjelp leading-relaxed text-dempet">
          {utfallVisning(utfall, false).under}
        </p>
      )}
      </SekvensDel>

      {/* Registrert stadium/status og relevant frist: situasjonen før valgene. */}
      {nesteFrist && (
        <SekvensDel>
          <FristRad
            forfallsdato={nesteFrist.forfallsdato}
            tittel={nesteFrist.tittel}
            gammeltBrev={fristBrevGammelt}
            className="mt-3"
          />
          {nesteFrist.kilde === "beregnet" && nesteFristBrev?.brevdato ? (
            <Utregning
              className="mt-2"
              rader={[
                {
                  etikett: "Brevet er datert",
                  verdi: formaterDato(nesteFristBrev.brevdato),
                },
                {
                  etikett: "Lovbestemt frist",
                  verdi: `${LOVBESTEMT_FRIST_DAGER} dager`,
                },
                {
                  etikett: "Fristen løper ut",
                  verdi: formaterDato(nesteFrist.forfallsdato),
                  uthevet: true,
                },
              ]}
              kildelinje={
                nesteFristBrev.brevtype &&
                FRIST_HJEMMEL[nesteFristBrev.brevtype] ? (
                  <p className="mt-2 text-meta text-dempet">
                    {FRIST_HJEMMEL[nesteFristBrev.brevtype]}
                  </p>
                ) : undefined
              }
            />
          ) : nesteFrist.kilde !== "beregnet" ? (
            <p className="mt-2 text-meta text-dempet">
              Fristen står oppgitt i brevet.
            </p>
          ) : null}
          <FristKnapp fristId={nesteFrist.id} handling="fullfort" />
        </SekvensDel>
      )}

      {sak.status === "venter_pa_svar" && oppfolgingTilstandVerdi && (
        <SekvensDel>
          <Kort className="mt-seksjon">
            <p className="text-[14.5px] font-semibold text-blekk">
              Venter på svar fra {inkassoselskap ?? sak.kreditor ?? sak.tittel}
            </p>
            <p className="mt-0.5 text-hjelp text-dempet">
              {oppfolgingTekst(
                oppfolgingTilstandVerdi,
                inkassoselskap ?? sak.kreditor ?? sak.tittel,
                varslerPa,
              )}
            </p>
            <div className="-mx-[18px] -mb-[18px] mt-3 border-t-[0.5px] border-strek">
              <VenterPaSvarUtvidelse kravId={sak.id} />
            </div>
          </Kort>
        </SekvensDel>
      )}

      {/* Viktigste varsel eller handlingsvalg. Alvorsvarsel overstyrer
          vanlige handlingsvalg (uendret betingelse). */}
      {sisteBrevGammelt && sisteBrev && sisteBrevDato && !lost && (
        <SekvensDel>
          <GammeltBrevKort
            brevId={sisteBrev.id}
            kravId={sak.id}
            datoTekst={formaterDagManed(sisteBrevDato)}
            uker={Math.floor(
              brevAlderDager(sisteBrev.brevdato, sisteBrev.opprettet, idag) / 7,
            )}
            className="mt-seksjon"
          />
        </SekvensDel>
      )}

      {erSakAlvorlig && !lost ? (
        <SekvensDel>
          <Alvorsvarsel signalord={signalord as string} className="mt-seksjon" />
        </SekvensDel>
      ) : (
        stotterUtkast(stadium) &&
        !lost && (
          <SekvensDel>
            <Veivalg
              className="mt-seksjon"
              harGebyrfunn={harOverGebyr}
              gebyrDifferanse={overDiff}
              svarMål={{ type: "href", href: `/krav/${sak.id}/utkast?type=innsigelse` }}
              betaleMål={{ type: "href", href: `/krav/${sak.id}/veier-ut` }}
            />
          </SekvensDel>
        )
      )}

      {/* Detaljer om funn. */}
      {harFunnListe && (
        <SekvensDel>
          <h2 className="seksjonstittel mt-seksjon text-blekk">Funn i brevet</h2>
          <FunnListe className="mt-gruppe">
            {harOverGebyr && sisteBrev?.gebyrsjekk && (
              <DomMini
                resultat={sisteBrev.gebyrsjekk}
                utkastHref={
                  stotterUtkast(stadium)
                    ? `/krav/${sak.id}/utkast?type=innsigelse`
                    : undefined
                }
                historisk={sisteBrevGammelt}
                brevdato={sisteBrevDato}
              />
            )}
            {harFristfunn && sisteBrev?.fristfunn && (
              <DomMiniFrist
                differanseDager={Math.abs(sisteBrev.fristfunn.differanseDager ?? 0)}
                brevdato={sisteBrev.brevdato}
                beregnetDato={sisteBrev.fristfunn.beregnetDato as string}
                historisk={sisteBrevGammelt}
              />
            )}
            <HovedstolVarsel avvik={hovedstolAvvik} />
          </FunnListe>
        </SekvensDel>
      )}


      {/* Siste brev: egen inngang før historikken. */}
      {sisteBrev && (
        <SekvensDel>
          <Link
            href={`/krav/${sak.id}/brev/${sisteBrev.id}`}
            className="trykk mt-seksjon flex min-h-[60px] items-center gap-3 rounded-kort border border-kant bg-flate px-4 py-3"
          >
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-liten bg-flate-2 text-dempet"
            >
              <FileText className="size-[18px]" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="radtittel block text-blekk">
                Siste brev: {brevtypeEtikett(sisteBrev.brevtype).toLowerCase()}
              </span>
              <span className="radtekst block truncate">
                {[
                  sisteBrev.avsender,
                  sisteBrev.brevdato ? formaterKortDato(sisteBrev.brevdato) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <span className="shrink-0 text-hjelp font-semibold text-aksent-dyp">
              Åpne brevet
            </span>
            <ChevronRight className="size-4 shrink-0 text-dempet" aria-hidden />
          </Link>
        </SekvensDel>
      )}

      {/* Historikk. */}
      <SekvensDel>
      {hendelser.length === 0 ? (
        <>
          <h2 className="seksjonstittel mb-gruppe mt-seksjon text-blekk">
            Sakens gang
          </h2>
          <p className="text-sm text-dempet">
            Ingen hendelser ennå. Legg til det første brevet.
          </p>
        </>
      ) : (
        <SakensGangSeksjon
          antall={hendelser.length}
          forhand={<Tidslinje>{hendelser.slice(0, FORHAND)}</Tidslinje>}
        >
          {hendelser.length > FORHAND ? (
            <Tidslinje>{hendelser.slice(FORHAND)}</Tidslinje>
          ) : undefined}
        </SakensGangSeksjon>
      )}
      </SekvensDel>
      </Sekvens>

      <div className="my-seksjon">
        <Primærknapp href={`/legg-til-brev?krav=${sak.id}`} variant="rolig">
          <Plus className="-mt-0.5 mr-1.5 inline size-4" aria-hidden />
          Legg til brev i saken
        </Primærknapp>
      </div>
    </Skjermramme>
  );
}
