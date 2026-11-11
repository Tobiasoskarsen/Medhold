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
  HeltChip,
  Snarvei,
} from "@/components/ui";
import { ChevronRight, FilePlus2 } from "lucide-react";
import { HjelpKnapp } from "./HjelpKnapp";
import { dagerTil, formaterDagManed, formaterTallDato, idagOslo } from "@/lib/dato";
import { erHastende, erGammeltBrev, fristChipTekst } from "@/lib/frist";
import { formaterBelop } from "@/lib/format";
import { STADIUM_ETIKETT, stotterUtkast, type Stadium } from "@/lib/gjeld";
import type { SakStatus, SakUtfall } from "@/lib/types";
import type { GebyrsjekkResultat } from "@/lib/gebyr";
import { hjemIngress } from "@/lib/oversikt";
import { kanViseSeier, rangerSaker, relevantFrist } from "@/lib/prioritet";
import { kr, overLinjer, totalOver } from "@/lib/gebyrfunn-visning";
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

/** Dagens dato: «Tirsdag 3. november» (norsk tid — se dato.ts). */
function idagEyebrow(): string {
  const s = new Date().toLocaleDateString("nb-NO", {
    timeZone: "Europe/Oslo",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

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

export default async function HjemPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const varslerPa = user?.user_metadata?.varsler_paa !== false;
  // Samme navnegrunnlag som Meg: brevnavn med fallback til det gamle
  // fornavn-feltet. Kun første ord vises her.
  const fornavn =
    (
      (user?.user_metadata?.brevnavn as string | undefined) ??
      (user?.user_metadata?.fornavn as string | undefined)
    )
      ?.trim()
      .split(/\s+/)[0] || null;

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
  const utlopte = frister.filter((f) => dagerTil(f.forfallsdato) < 0);

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

  // Ingressens grunnlag (§5.1).
  const sakerDenneUka = new Set(
    frister
      .filter((f) => {
        const d = dagerTil(f.forfallsdato);
        return d >= 0 && d <= 7;
      })
      .map((f) => f.sak_id),
  );
  const ingress = hjemIngress({
    antallSaker: saker.length,
    antallAktive: aktiveSaker.length,
    antallUtlopteFrister: utlopte.length,
    antallUtlopteFraGamleBrev: utlopte.filter(fraGammeltBrev).length,
    sakerMedFristDenneUka: sakerDenneUka.size,
    toppVenter: topSak?.status === "venter_pa_svar",
  });

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

  // Gebyrsjekk på heltekortet: samme nyeste brev som før, nå også totalen
  // til «{n} kr for mye»-chipen (ingen ny spørring).
  let gebyrOver = 0;
  if (topSak && stotterUtkast(topSak.stadium ?? null)) {
    const { data: nyesteBrev } = await supabase
      .from("brev")
      .select("gebyrsjekk")
      .eq("sak_id", topSak.id)
      .order("brevdato", { ascending: false, nullsFirst: false })
      .order("opprettet", { ascending: false })
      .limit(1)
      .maybeSingle();
    const gs = nyesteBrev?.gebyrsjekk as GebyrsjekkResultat | null;
    if ((gs?.antallOver ?? 0) > 0 && gs) gebyrOver = totalOver(overLinjer(gs));
  }
  const hjemHarOverGebyr = gebyrOver > 0;

  // «Andre saker» (§5.3): samme rangering som toppsaken, uten den.
  const andreSaker = rangert.slice(1, 1 + ANDRE_SAKER_MAKS);

  const navnPa = (s: SakKobling) => s.kreditor ?? s.tittel;
  const kreditorLinje = (s: SakKobling) => (
    <p className="mt-2 text-brod font-semibold text-helt-tekst">{navnPa(s)}</p>
  );
  const belopLinje = (s: SakKobling) =>
    s.belop_totalt != null ? (
      <p className="mt-0.5">
        <Belop verdi={s.belop_totalt} className="tall-l" />
      </p>
    ) : null;

  // Med flere saker på brede skjermer: viktigste sak til venstre, øvrige til
  // høyre. Samme rekkefølge i DOM og på mobil.
  const toKolonner = andreSaker.length > 0;
  const forstegang = !harKrav;

  return (
    <Skjermramme className="pt-5" animerInn={false} bred={toKolonner}>
      <div className={toKolonner ? "lg:grid lg:grid-cols-2 lg:gap-x-8" : ""}>
      <Sekvens>
      <SekvensDel className="lg:col-span-2">
        {/* Kompakt velkomst: dato, navn og situasjon. Profilen ligger i menyen. */}
        <p className="text-hjelp font-medium text-dempet">{idagEyebrow()}</p>
        <h1 className="tittel mt-0.5 text-blekk">
          {fornavn ? `Hei, ${fornavn}` : "Hei"}
        </h1>
        <p className="mt-1 text-[14px] text-dempet">{ingress}</p>
      </SekvensDel>

      <SekvensDel className="lg:col-start-1">
        <div className="mt-4">
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
              <p className="mt-1 text-[14px] text-helt-dempet">
                Ta bilde av brevet, last opp en fil eller lim inn teksten.
              </p>
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
              <p className="mt-2 text-brod font-semibold">{navnPa(seierSak)}</p>
              <p className="tall-m mt-1 text-gull">Medhold.</p>
              <p className="mt-2 text-hjelp">
                Kravet ble frafalt etter innsigelsen din.
              </p>
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
              {kreditorLinje(topSak)}
              {belopLinje(topSak)}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <HeltChip variant="funn">Alvorlig varsel</HeltChip>
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
              {kreditorLinje(topSak)}
              {belopLinje(topSak)}
              {venterFrist && <div className="mt-3 rounded-kontroll border border-strek bg-flate-2/40 px-3 py-3">
                <p className="text-hjelp font-semibold text-helt-tekst">{venterFrist.tittel}</p>
                <p className="mt-1 text-brod font-bold tabular-nums text-helt-tekst">{formaterDagManed(venterFrist.forfallsdato)}</p>
                <p className="mt-1 text-meta text-helt-dempet">Se fristgrunnlaget i saken.</p>
              </div>}
              <p className="mt-3 text-hjelp text-helt-dempet">{oppfolgingTilstandVerdi ? oppfolgingTekstKort(oppfolgingTilstandVerdi, varslerPa) : "Ta vare på kvitteringen"}</p>
              <p className="mt-1 text-meta leading-relaxed text-helt-dempet">Oppfølgingen er separat og endrer ikke fristen i brevet.</p>
            </Heltekort>
          ) : (
            <Heltekort
              etikett="Viktigste sak"
              href={`/krav/${topSak.id}`}
              knapp={
                // «Lag svar» bare når det finnes et funn å svare med; ellers
                // inn i saken først, der valgene forklares.
                hjemHarOverGebyr && stotterUtkast(topSak.stadium ?? null) ? (
                  <Primærknapp
                    href={`/krav/${topSak.id}/utkast?type=innsigelse`}
                    variant="lys"
                  >
                    Lag svar
                  </Primærknapp>
                ) : (
                  <Primærknapp href={`/krav/${topSak.id}`} variant="lys">
                    Se saken
                  </Primærknapp>
                )
              }
            >
              {kreditorLinje(topSak)}
              {belopLinje(topSak)}
              {topFrist && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {dagerTil(topFrist.forfallsdato) < 0 &&
                  topFrist.brev_id &&
                  fraGammeltBrev(topFrist) ? (
                    <HeltChip variant="noytral">
                      Brev fra{" "}
                      {formaterTallDato(brevDatoPerId.get(topFrist.brev_id) ?? "")}
                    </HeltChip>
                  ) : dagerTil(topFrist.forfallsdato) < 0 ? (
                    <HeltChip variant="funn">
                      Frist utløpt · {formaterDagManed(topFrist.forfallsdato)}
                    </HeltChip>
                  ) : (
                    <HeltChip variant="noytral">
                      {fristChipTekst(dagerTil(topFrist.forfallsdato))} ·{" "}
                      {formaterDagManed(topFrist.forfallsdato)}
                    </HeltChip>
                  )}
                </div>
              )}
              {/* Funnet er noe annet enn det registrerte kravbeløpet. */}
              {hjemHarOverGebyr && (
                <p className="mt-3 border-t border-helt-chip pt-2.5 text-hjelp font-semibold text-helt-tekst">
                  Gebyrsjekk: {kr(gebyrOver)} kr over maksimalsats
                </p>
              )}
            </Heltekort>
          )}
        </div>
      </SekvensDel>

      {/* Andre saker kommer rett etter hovedkortet (før generelle snarveier). */}
      {andreSaker.length > 0 && (
        <SekvensDel className="lg:col-start-2 lg:row-span-3 lg:row-start-2">
          <div className="mb-gruppe mt-seksjon flex items-baseline justify-between lg:mt-4">
            <h2 className="seksjonstittel text-blekk">Andre saker</h2>
            <Link
              href="/krav"
              className="-my-3 py-3 text-hjelp font-semibold text-dempet transition hover:text-blekk"
            >
              Se alle
            </Link>
          </div>
          <ul className="rounded-kort border border-kant bg-flate px-4">
            {andreSaker.map((rad, i) => {
              const s = rad.sak;
              // En gammel utløpt frist er historikk: vis stadiet i stedet.
              const frist =
                rad.klasse !== "historikk" ? rad.frist?.forfallsdato : undefined;
              const dager = frist ? dagerTil(frist) : null;
              const [undertekst, hastende] =
                s.status === "venter_pa_svar"
                  ? ["Venter på svar", false]
                  : dager != null
                    ? [fristChipTekst(dager), erHastende(dager)]
                    : [s.stadium ? stor(STADIUM_ETIKETT[s.stadium]) : "", false];
              const belop = formaterBelop(s.belop_totalt);
              return (
                <li key={s.id} className={i > 0 ? "border-t border-strek" : ""}>
                  <Link
                    href={`/krav/${s.id}`}
                    className="trykk flex min-h-[60px] items-center gap-3 py-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="radtittel line-clamp-2 text-blekk">
                        {navnPa(s)}
                      </span>
                      {undertekst && (
                        <span
                          className={`radtekst block ${
                            hastende ? "font-semibold !text-dom-rod" : ""
                          }`}
                        >
                          {undertekst}
                        </span>
                      )}
                    </span>
                    {belop && (
                      <span className="shrink-0 text-brod font-bold tabular-nums text-blekk">
                        {belop} kr
                      </span>
                    )}
                    <ChevronRight className="size-4 shrink-0 text-dempet" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </SekvensDel>
      )}

      {forstegang ? (
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
      ) : (
        <SekvensDel className="lg:col-start-1">
          <div className="mt-seksjon grid grid-cols-2 gap-2 lg:mt-4">
            <Snarvei ikon={FilePlus2} tittel="Legg til brev" href="/legg-til-brev" />
            <HjelpKnapp />
          </div>
        </SekvensDel>
      )}

      {/* Kort forklaring ved få saker — samme flyt som finnes, ingen nye løfter. */}
      {!forstegang && aktiveSaker.length <= 1 && (
        <SekvensDel className="lg:col-start-1">
          <p className="mt-5 px-1 text-hjelp leading-relaxed text-dempet">
            Legg til brevet og sjekk tallene mot det. Vi kontrollerer støttede
            gebyrer og frister, og lager et utkast du kan redigere. Du sender
            brevet selv.
          </p>
        </SekvensDel>
      )}
      </Sekvens>
      </div>
    </Skjermramme>
  );
}
