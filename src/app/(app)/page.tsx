import { NavLenke as Link } from "@/components/NavLenke";
import { createClient } from "@/lib/supabase/server";
import {
  Skjermramme,
  Kort,
  Primærknapp,
  Belop,
  Sekvens,
  SekvensDel,
  Heltekort,
} from "@/components/ui";
import { ChevronRight } from "lucide-react";
import { HjelpKnapp } from "./HjelpKnapp";
import { KreditorAvatar } from "@/components/KreditorAvatar";
import { dagerTil, formaterDagManed, formaterTallDato, idagOslo } from "@/lib/dato";
import { erHastende, erGammeltBrev, fristChipTekst } from "@/lib/frist";
import { formaterBelop } from "@/lib/format";
import { STADIUM_ETIKETT, stotterUtkast, type Stadium } from "@/lib/gjeld";
import type { SakStatus, SakUtfall } from "@/lib/types";
import { ProfilKnapp } from "@/components/ProfilKnapp";
import { initialerFra } from "@/lib/tint";
import { sumavvikFra } from "@/lib/sumkontroll";
import { muligAvvikTotal, nyesteBrevPerSak, utestaaendeTotal } from "@/lib/oversikt";
import { kanViseSeier, rangerSaker, relevantFrist } from "@/lib/prioritet";
import { kr, sumavvikLinje } from "@/lib/gebyrfunn-visning";
import {
  dagerTilOppfolging,
  oppfolgingTilstand,
  type OppfolgingTilstand,
} from "@/lib/oppfolging";

type SakKobling = {
  id: string;
  kreditor: string | null;
  tittel: string;
  belop_totalt: number | null;
  stadium: Stadium | null;
  status: SakStatus;
  utfall?: SakUtfall | null;
};

type AapenFrist = {
  id: string;
  sak_id: string;
  brev_id: string | null;
  tittel: string;
  forfallsdato: string;
  saker: SakKobling | null;
};

const ANDRE_SAKER_MAKS = 3;

function stor(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Ventetid som synlig aktivitet (§5), kortform på Hjem sitt heltekort. Er
 * e-postpåminnelser av, loves ingen e-post appen ikke sender.
 */
function oppfolgingTekstKort(
  tilstand: OppfolgingTilstand,
  varslerPa: boolean,
): string {
  switch (tilstand.type) {
    case "kommer":
      return varslerPa
        ? `Påminnelse om ${tilstand.dager} dager`
        : `Følg opp selv om ${tilstand.dager} dager`;
    case "i_dag":
      return varslerPa ? "Påminnelse i dag" : "Følg opp selv i dag";
    case "sendt":
      return "Påminnelsen er sendt";
    case "na":
      return varslerPa ? "Påminnelse på vei" : "Følg opp selv nå";
  }
}

const navnPa = (x: SakKobling) => x.kreditor ?? x.tittel;

/** Navn, én statuslinje og beløp: raden i heltekortet (R8). */
function SakRad({
  sak: x,
  status,
  hastende = false,
  gull = false,
}: {
  sak: SakKobling;
  status: string;
  hastende?: boolean;
  gull?: boolean;
}) {
  const belop = formaterBelop(x.belop_totalt);
  return (
    <div className="flex items-center gap-3">
      <KreditorAvatar navn={navnPa(x)} className="size-12 text-[18px]" />
      <span className="min-w-0 flex-1">
        <span className="block line-clamp-2 text-[17px] font-semibold text-helt-tekst">{navnPa(x)}</span>
        <span
          className={`block text-[14px] ${
            gull ? "font-semibold text-gull" : hastende ? "font-semibold text-dom-rod" : "text-helt-dempet"
          }`}
        >
          {status}
        </span>
      </span>
      {belop && (
        <span className="shrink-0 text-[17px] font-bold tabular-nums text-helt-tekst">{belop} kr</span>
      )}
    </div>
  );
}

export default async function HjemPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const varslerPa = user?.user_metadata?.varsler_paa !== false;
  const initialer = initialerFra(
    (user?.user_metadata?.brevnavn as string | undefined) ??
      (user?.user_metadata?.fornavn as string | undefined),
    user?.email,
  );

  const [{ data: sakData }, { data: fristData }, { data: brevData }] =
    await Promise.all([
      supabase
        .from("saker")
        .select(
          "id, kreditor, tittel, belop_totalt, stadium, status, utfall, sist_endret",
        )
        .order("sist_endret", { ascending: false }),
      supabase
        .from("frister")
        .select(
          "id, sak_id, brev_id, tittel, forfallsdato, saker(id, kreditor, tittel, belop_totalt, stadium, status, utfall)",
        )
        .eq("fullfort", false),
      // Nyeste brev per sak (alvorsgrensen, §B.5) — ÉN spørring, ingen N+1.
      supabase
        .from("brev")
        .select("id, sak_id, opprettet, alvorlig, brevdato")
        .order("opprettet", { ascending: false }),
    ]);

  const saker = (sakData ?? []) as (SakKobling & { sist_endret: string })[];
  // Verken markerLost eller markerUtkastSendt lukker sakens åpne frister
  // automatisk når status endres — filtrer bort frister som tilhører en sak
  // som ikke lenger er aktiv, så en gjenglemt frist ikke overstyrer «venter
  // på svar» eller drar en løst sak tilbake på heltekortet.
  const frister = ((fristData ?? []) as unknown as AapenFrist[]).filter(
    (f) => f.saker?.status === "aktiv",
  );

  frister.sort((a, b) => {
    if (a.forfallsdato !== b.forfallsdato)
      return a.forfallsdato < b.forfallsdato ? -1 : 1;
    return (b.saker?.belop_totalt ?? 0) - (a.saker?.belop_totalt ?? 0);
  });

  const harKrav = saker.length > 0;
  const aktiveSaker = saker.filter((s) => s.status !== "fullfort");

  // Gamle brev (MEDHOLD_SIKKERHET_ARBEIDSORDRE §C.2): en utløpt frist fra et
  // brev over 45 dager gammelt er historikk — ingen «En frist har gått ut» og
  // ingen rød «Frist utløpt»-chip. Fristens EGET brev avgjør (brev_id).
  const idag = idagOslo();
  const brevDatoPerId = new Map<string, string>();
  const gammeltPerBrev = new Map<string, boolean>();
  for (const b of brevData ?? []) {
    const brevdato = (b.brevdato as string | null) ?? null;
    brevDatoPerId.set(b.id, brevdato ?? b.opprettet.slice(0, 10));
    gammeltPerBrev.set(b.id, erGammeltBrev(brevdato, b.opprettet, idag));
  }
  const fraGammeltBrev = (f: AapenFrist) =>
    !!f.brev_id && (gammeltPerBrev.get(f.brev_id) ?? false);

  // Viktigste sak og rekkefølgen på resten: én felles, testet regel
  // (lib/prioritet.ts). Alvorlighet og kommende frister går foran gamle frister.
  const rangert = rangerSaker(saker, frister, brevData ?? [], idag);
  const topp = rangert[0] ?? null;
  const topFrist = topp?.frist ?? null;
  const topSak: SakKobling | null = topp?.sak ?? null;
  const venter = !!topSak && topSak.status === "venter_pa_svar" && !topFrist;
  const topSakAlvorlig = topp?.alvorlig ?? false;

  // Kun visning i ventekortet, uten å endre rangering eller varslingsgrunnlag.
  const venterFrist = venter && topSak ? relevantFrist(
    ((fristData ?? []) as unknown as AapenFrist[]).filter(f => f.sak_id === topSak.id),
    (brevData ?? []).filter(b => b.sak_id === topSak.id), idag,
  )?.frist : null;

  // Ventetid som synlig aktivitet (§5). Samme definisjon av «siste
  // aktivitet» som krav-detalj/cron-en: nyeste av (utkast.sendt_at,
  // brev.opprettet).
  let oppfolgingTilstandVerdi: OppfolgingTilstand | null = null;
  if (venter && topSak) {
    const brevOpprettetDatoer = (brevData ?? [])
      .filter((b) => b.sak_id === topSak.id)
      .map((b) => b.opprettet);
    const { data: utkastData } = await supabase
      .from("utkast")
      .select("sendt_at")
      .eq("sak_id", topSak.id)
      .not("sendt_at", "is", null);
    const sisteAktivitet = [
      ...(utkastData ?? []).map((u) => u.sendt_at as string),
      ...brevOpprettetDatoer,
    ]
      .sort()
      .at(-1);
    if (sisteAktivitet) {
      const { data: oppfolging } = await supabase
        .from("sendte_oppfolginger")
        .select("sak_id")
        .eq("sak_id", topSak.id)
        .maybeSingle();
      oppfolgingTilstandVerdi = oppfolgingTilstand(
        dagerTilOppfolging(sisteAktivitet, new Date()),
        !!oppfolging,
      );
    }
  }

  // Seier: nyeste sak er løst med medhold, og ingen saker er åpne. Kortet
  // skal aldri ta plassen til en sak som krever oppmerksomhet.
  const seierSak = kanViseSeier(saker) ? saker[0] : null;

  // Nyeste brev med gebyrsjekk for alle åpne saker i ÉN spørring (ingen N+1).
  // Sorteringen (brevdato synkende, så opprettet) gjøres i nyesteBrevPerSak.
  const aapneIder = aktiveSaker.map((x) => x.id);
  const { data: sjekkData } = aapneIder.length
    ? await supabase
        .from("brev")
        .select("sak_id, brevdato, opprettet, gebyrsjekk")
        .in("sak_id", aapneIder)
    : { data: [] };
  const nyesteBrev = nyesteBrevPerSak(
    (sjekkData ?? []) as {
      sak_id: string;
      brevdato: string | null;
      opprettet: string;
      gebyrsjekk: unknown;
    }[],
  );

  // Totalen og «Mulig avvik» øverst (R8). Begge leser bare lagrede tall.
  const utestaaende = utestaaendeTotal(saker);
  const avvik = muligAvvikTotal(saker, nyesteBrev);

  // Toppsaken: gebyrfunn og beløpskontroll fra samme nyeste brev.
  const toppSjekk = topSak ? nyesteBrev.get(topSak.id)?.gebyrsjekk ?? null : null;
  const hjemSumavvik = sumavvikFra(toppSjekk);

  // «Andre saker» (§5.3): samme rangering som toppsaken, uten den.
  const andreSaker = rangert.slice(1, 1 + ANDRE_SAKER_MAKS);

  const forstegang = !harKrav;

  // Statuslinjen for toppsaken i standardgrenen: frist, ellers stadiet.
  let toppStatus = topSak?.stadium ? stor(STADIUM_ETIKETT[topSak.stadium]) : "";
  let toppHastende = false;
  if (topFrist) {
    const d = dagerTil(topFrist.forfallsdato);
    if (d < 0 && topFrist.brev_id && fraGammeltBrev(topFrist)) {
      // En gammel utløpt frist er historikk, ikke en akutt fare.
      toppStatus = `Brev fra ${formaterTallDato(brevDatoPerId.get(topFrist.brev_id) ?? "")}`;
    } else if (d < 0) {
      toppStatus = `Frist utløpt · ${formaterDagManed(topFrist.forfallsdato)}`;
      toppHastende = true;
    } else {
      // Samme hastegrense (≤ 10 dager) som Saker og saken.
      toppStatus = fristChipTekst(d);
      toppHastende = erHastende(d);
    }
  }

  return (
    <Skjermramme className="pt-3" animerInn={false}>
      <Sekvens>
      <SekvensDel>
        <ProfilKnapp initialer={initialer} className="-ml-1" />
      </SekvensDel>

      {harKrav && (
        <SekvensDel>
          <div className="mt-2 flex flex-col items-center text-center">
            <p className="text-[15px] text-dempet">Utestående krav</p>
            <p className="mt-1.5">
              <Belop
                verdi={utestaaende}
                className="text-[44px] font-bold leading-none tracking-[-0.02em] tabular-nums text-blekk"
              />
            </p>
            {avvik.sum > 0 && avvik.stortSakId && (
              <Link
                href={`/krav/${avvik.stortSakId}`}
                className="trykk mt-3 inline-flex min-h-11 items-center gap-1 rounded-full bg-dom-rod-bg px-3.5 text-[13px] font-semibold text-dom-rod focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dom-rod"
              >
                Mulig avvik: {kr(avvik.sum)} kr
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            )}
          </div>
        </SekvensDel>
      )}

      <SekvensDel>
        <div className="mt-6">
          {forstegang ? (
            <Heltekort
              etikett="Kom i gang"
              knapp={
                <Primærknapp href="/legg-til-brev" variant="lys">
                  Legg til brev
                </Primærknapp>
              }
            >
              <p className="tittel-s mt-2">Forstå brevet ditt</p>
            </Heltekort>
          ) : seierSak ? (
            <Heltekort
              etikett="Medhold"
              variant="gull"
              href={`/krav/${seierSak.id}`}
              knapp={
                <Primærknapp href={`/krav/${seierSak.id}/del`} variant="gull">
                  Del resultatet
                </Primærknapp>
              }
            >
              <div className="mt-3">
                <SakRad sak={seierSak} status="Medhold – kravet er frafalt" gull />
              </div>
            </Heltekort>
          ) : !topSak ? (
            <Kort>
              <p className="text-brod leading-relaxed text-blekk">
                Ingen aktive saker akkurat nå.
              </p>
              <div className="mt-4">
                <Primærknapp href="/legg-til-brev" variant="rolig">
                  Legg til brev
                </Primærknapp>
              </div>
            </Kort>
          ) : topSakAlvorlig ? (
            <Heltekort
              etikett="Viktig"
              href={`/krav/${topSak.id}`}
              knapp={
                <Primærknapp href={`/krav/${topSak.id}`} variant="lys">
                  Se hva du bør gjøre
                </Primærknapp>
              }
            >
              <div className="mt-3">
                <SakRad sak={topSak} status="Alvorlig varsel" hastende />
              </div>
            </Heltekort>
          ) : venter ? (
            <Heltekort
              etikett="Venter på svar"
              href={`/krav/${topSak.id}`}
              knapp={
                <Primærknapp href={`/legg-til-brev?krav=${topSak.id}`} variant="lys">
                  Legg til svarbrev
                </Primærknapp>
              }
            >
              <div className="mt-3">
                <SakRad sak={topSak} status="Venter på svar" />
              </div>
              {venterFrist && (
                <p className="mt-3 text-[14px] text-helt-tekst">
                  {venterFrist.tittel} · <span className="font-semibold tabular-nums">{formaterDagManed(venterFrist.forfallsdato)}</span>
                </p>
              )}
              <p className="mt-1 text-[13px] text-helt-dempet">
                {oppfolgingTilstandVerdi ? oppfolgingTekstKort(oppfolgingTilstandVerdi, varslerPa) : "Ta vare på kvitteringen"}
                {" · "}Oppfølgingen er separat og endrer ikke fristen i brevet.
              </p>
            </Heltekort>
          ) : (
            <Heltekort
              etikett="Trenger oppfølging"
              href={`/krav/${topSak.id}`}
              knapp={
                // «Lag svar» bare når det finnes et funn å svare med; ellers
                // inn i saken først, der valgene forklares.
                (avvik.stortSakId === topSak.id) && stotterUtkast(topSak.stadium ?? null) ? (
                  <Primærknapp
                    href={`/krav/${topSak.id}/utkast?type=innsigelse`}
                    variant="lys"
                  >
                    Lag svar
                  </Primærknapp>
                ) : (
                  <Primærknapp href={`/krav/${topSak.id}`} variant="lys">
                    Se hva du kan gjøre
                  </Primærknapp>
                )
              }
            >
              <div className="mt-3">
                <SakRad sak={topSak} status={toppStatus} hastende={toppHastende} />
              </div>
              {/* Beløpskontrollen er et funn og skal aldri skjules. */}
              {hjemSumavvik && (
                <p className="mt-3 border-t border-helt-chip pt-2.5 text-[13px] font-semibold text-dom-rod">
                  {sumavvikLinje(hjemSumavvik)}
                </p>
              )}
            </Heltekort>
          )}
        </div>
      </SekvensDel>

      {/* Andre saker rett etter hovedkortet. */}
      {andreSaker.length > 0 && (
        <SekvensDel>
          <ul className="mt-4 rounded-helt border border-kant bg-flate px-4 py-1">
            {andreSaker.map((rad, i) => {
              const x = rad.sak;
              // En gammel utløpt frist er historikk: vis stadiet i stedet.
              const frist =
                rad.klasse !== "historikk" ? rad.frist?.forfallsdato : undefined;
              const dager = frist ? dagerTil(frist) : null;
              const [status, hastende] =
                x.status === "venter_pa_svar"
                  ? ["Venter på svar", false]
                  : dager != null
                    ? [fristChipTekst(dager), erHastende(dager)]
                    : [x.stadium ? stor(STADIUM_ETIKETT[x.stadium]) : "", false];
              const belop = formaterBelop(x.belop_totalt);
              return (
                <li key={x.id} className={i > 0 ? "border-t border-strek" : ""}>
                  <Link
                    href={`/krav/${x.id}`}
                    className="trykk flex min-h-[64px] items-center gap-3 py-3"
                  >
                    <KreditorAvatar navn={navnPa(x)} className="size-11 text-[17px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17px] font-semibold text-blekk">{navnPa(x)}</span>
                      {status && (
                        <span className={`block text-[14px] ${hastende ? "font-semibold text-dom-rod" : "text-dempet"}`}>
                          {status}
                        </span>
                      )}
                    </span>
                    {belop && (
                      <span className="shrink-0 text-[17px] font-bold tabular-nums text-blekk">{belop} kr</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-1 flex justify-center">
            <Link
              href="/krav"
              className="trykk inline-flex min-h-11 items-center px-3 text-hjelp font-semibold text-dempet transition hover:text-blekk"
            >
              Se alle
            </Link>
          </div>
        </SekvensDel>
      )}

      {forstegang && (
        <SekvensDel>
          {/* Førstegangstilstand: hva som skjer, ingen tom saksoversikt. */}
          <h2 className="seksjonstittel mt-seksjon text-blekk">Slik fungerer det</h2>
          <ol className="mt-gruppe flex flex-col gap-3">
            {[
              "Legg til brevet.",
              "Sjekk opplysningene.",
              "Velg neste steg.",
            ].map((steg, i) => (
              <li key={steg} className="flex items-center gap-3 text-brod text-blekk">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-flate-2 text-hjelp font-bold tabular-nums">
                  {i + 1}
                </span>
                {steg}
              </li>
            ))}
          </ol>
          <div className="mt-5 flex justify-center">
            <HjelpKnapp variant="lenke" />
          </div>
        </SekvensDel>
      )}
      </Sekvens>
    </Skjermramme>
  );
}
