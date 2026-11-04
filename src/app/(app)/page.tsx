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
import { FilePlus2, FolderOpen, Scale, CircleHelp } from "lucide-react";
import { dagerTil, fristNærhet, formaterTallDato, idagOslo } from "@/lib/dato";
import { erHastende, erGammeltBrev, fristChipTekst } from "@/lib/frist";
import { formaterBelop } from "@/lib/format";
import { STADIUM_ETIKETT, stotterUtkast, type Stadium } from "@/lib/gjeld";
import type { SakStatus, SakUtfall } from "@/lib/types";
import type { GebyrsjekkResultat } from "@/lib/gebyr";
import { hjemIngress } from "@/lib/oversikt";
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
        ? `Purrer om ${tilstand.dager} dager`
        : `Følg opp selv om ${tilstand.dager} dager`;
    case "i_dag":
      return varslerPa ? "Purrer i dag" : "Følg opp selv i dag";
    case "sendt":
      return "Oppfølging er sendt";
    case "na":
      return varslerPa ? "Vi følger opp nå" : "Følg opp selv nå";
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
  const avatarBokstav = (fornavn?.[0] ?? user?.email?.[0] ?? "M").toUpperCase();

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

  // Nyeste brev sin alvorlighet per sak (DB-sortert nyeste først → første
  // treff per sak_id holdes).
  const alvorligPerSak = new Map<string, boolean>();
  for (const b of brevData ?? []) {
    if (alvorligPerSak.has(b.sak_id)) continue;
    alvorligPerSak.set(b.sak_id, !!b.alvorlig);
  }

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

  // Tidligste åpne frist per sak (frister er allerede sortert på dato).
  const nesteFristPerSak = new Map<string, string>();
  for (const f of frister) {
    if (!nesteFristPerSak.has(f.sak_id)) nesteFristPerSak.set(f.sak_id, f.forfallsdato);
  }

  const topFrist = frister[0] ?? null;
  const topSak = topFrist?.saker ?? aktiveSaker[0] ?? null;
  const venter = !!topSak && topSak.status === "venter_pa_svar" && !topFrist;
  const topSakAlvorlig = topSak ? (alvorligPerSak.get(topSak.id) ?? false) : false;

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

  // Seier: nyeste sak er løst med medhold, og ingen presserende frist.
  const seierSak =
    !topFrist &&
    saker[0]?.status === "fullfort" &&
    saker[0]?.utfall === "medhold"
      ? saker[0]
      : null;

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

  // «Andre saker» (§5.3): aktive unntatt toppsaken. Med åpen frist først
  // (etter dato), deretter resten etter sist_endret (spørringen er allerede
  // nyeste først — stabil sort beholder det).
  const andreSaker = aktiveSaker
    .filter((s) => s.id !== topSak?.id)
    .sort((a, b) => {
      const fa = nesteFristPerSak.get(a.id);
      const fb = nesteFristPerSak.get(b.id);
      if (fa && fb) return fa < fb ? -1 : fa > fb ? 1 : 0;
      if (fa) return -1;
      if (fb) return 1;
      return 0;
    })
    .slice(0, ANDRE_SAKER_MAKS);

  const navnPa = (s: SakKobling) => s.kreditor ?? s.tittel;
  const kreditorLinje = (s: SakKobling) => (
    <p className="mt-3 text-[15px] font-semibold text-helt-dempet">{navnPa(s)}</p>
  );
  const belopLinje = (s: SakKobling) =>
    s.belop_totalt != null ? (
      <p className="mt-1">
        <Belop verdi={s.belop_totalt} className="tall-l" />
      </p>
    ) : null;

  return (
    <Skjermramme className="pt-6" animerInn={false}>
      <Sekvens>
      <SekvensDel>
        {/* Kompakt velkomst: dato og navn til venstre, profil til høyre. */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-hjelp font-medium text-dempet">{idagEyebrow()}</p>
            <h1 className="tittel mt-1 text-blekk">
              {fornavn ? `Hei, ${fornavn}` : "Hei"}
            </h1>
          </div>
          <Link
            href="/meg"
            aria-label="Meg"
            className="trykk -mr-1 flex size-11 shrink-0 items-center justify-center"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-aksent text-[14px] font-bold text-aksent-tekst">
              {avatarBokstav}
            </span>
          </Link>
        </div>
        <p className="mt-1.5 text-[14px] text-dempet">{ingress}</p>
      </SekvensDel>

      <SekvensDel>
        <div className="mt-5">
          {!harKrav ? (
            <Heltekort
              etikett="Kom i gang"
              knapp={
                <Primærknapp href="/legg-til-brev" variant="lys">
                  Legg til brev
                </Primærknapp>
              }
            >
              <p className="tittel-s mt-3">Legg inn ditt første brev</p>
              <p className="mt-1.5 text-[14px] text-helt-dempet">
                Ta bilde av brevet, så sjekker vi gebyrer og frister.
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
              <p className="mt-3 text-[15px] font-semibold">{navnPa(seierSak)}</p>
              <p className="tall-m mt-1 text-gull">Medhold.</p>
              <p className="mt-2 text-[13px]">
                Kravet ble frafalt etter innsigelsen din.
              </p>
            </Heltekort>
          ) : !topSak ? (
            <Kort>
              <p className="text-[15px] leading-relaxed text-blekk">
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
              <div className="mt-3.5 flex flex-wrap gap-1.5">
                <HeltChip variant="funn">Alvorlig varsel</HeltChip>
              </div>
            </Heltekort>
          ) : venter ? (
            <Heltekort
              etikett="Venter på svar"
              href={`/krav/${topSak.id}`}
              knapp={
                <Primærknapp href="/legg-til-brev" variant="lys">
                  Fått svar? Legg til brevet
                </Primærknapp>
              }
            >
              {kreditorLinje(topSak)}
              {belopLinje(topSak)}
              <div className="mt-3.5 flex flex-wrap gap-1.5">
                <HeltChip variant="noytral">
                  {oppfolgingTilstandVerdi
                    ? oppfolgingTekstKort(oppfolgingTilstandVerdi, varslerPa)
                    : "Ta vare på kvitteringen"}
                </HeltChip>
              </div>
            </Heltekort>
          ) : (
            <Heltekort
              etikett="Neste steg"
              href={`/krav/${topSak.id}`}
              knapp={
                stotterUtkast(topSak.stadium ?? null) ? (
                  <Primærknapp
                    href={`/krav/${topSak.id}/utkast${
                      hjemHarOverGebyr ? "?type=innsigelse" : ""
                    }`}
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
              {(topFrist || hjemHarOverGebyr) && (
                <div className="mt-3.5 flex flex-wrap gap-1.5">
                  {topFrist &&
                    (dagerTil(topFrist.forfallsdato) < 0 &&
                    topFrist.brev_id &&
                    fraGammeltBrev(topFrist) ? (
                      <HeltChip variant="noytral">
                        Brev fra{" "}
                        {formaterTallDato(brevDatoPerId.get(topFrist.brev_id) ?? "")}
                      </HeltChip>
                    ) : dagerTil(topFrist.forfallsdato) < 0 ? (
                      <HeltChip variant="funn">Frist utløpt</HeltChip>
                    ) : (
                      <HeltChip variant="noytral">
                        Frist {fristNærhet(topFrist.forfallsdato).toLowerCase()}
                      </HeltChip>
                    ))}
                  {hjemHarOverGebyr && (
                    <HeltChip variant="funn">{kr(gebyrOver)} kr for mye</HeltChip>
                  )}
                </div>
              )}
            </Heltekort>
          )}
        </div>
      </SekvensDel>

      {/* Snarveier: alltid nyttig innhold, også med null eller én sak. */}
      <SekvensDel>
        <h2 className="seksjonstittel mt-seksjon text-blekk">Hva vil du gjøre?</h2>
        <div className="mt-gruppe grid grid-cols-2 gap-2.5">
          <Snarvei
            ikon={FilePlus2}
            tittel="Legg til brev"
            tekst="Få brevet lest og sjekket"
            href="/legg-til-brev"
          />
          <Snarvei
            ikon={FolderOpen}
            tittel="Se saker"
            tekst="Alle brev og krav samlet"
            href="/krav"
          />
          <Snarvei
            ikon={Scale}
            tittel="Satsene vi bruker"
            tekst="Offentlige maksimalsatser"
            href="/satser"
          />
          <Snarvei
            ikon={CircleHelp}
            tittel="Få hjelp"
            tekst="Kontakt og personvern"
            href="/meg"
          />
        </div>
      </SekvensDel>

      {andreSaker.length > 0 && (
        <SekvensDel>
          <div className="mb-gruppe mt-seksjon flex items-baseline justify-between">
            <h2 className="seksjonstittel text-blekk">Andre saker</h2>
            <Link
              href="/krav"
              className="text-[13px] font-semibold text-dempet transition hover:text-blekk"
            >
              Se alle
            </Link>
          </div>
          <ul className="rounded-kort border border-kant bg-flate px-4">
            {andreSaker.map((s, i) => {
              const frist = nesteFristPerSak.get(s.id);
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
                    className="trykk flex items-center gap-3 py-[13px]"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-liten bg-flate-2 text-[14px] font-bold text-blekk">
                      {navnPa(s).charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="radtittel block truncate text-blekk">
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
                      <span className="shrink-0 text-[15px] font-bold tabular-nums text-blekk">
                        {belop} kr
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </SekvensDel>
      )}

      {/* Kort forklaring av flyten ved få saker — samme flyt som finnes, ingen
          nye løfter. Forsvinner når brukeren har flere saker å forholde seg til. */}
      {aktiveSaker.length <= 1 && (
        <SekvensDel>
          <div className="mt-seksjon rounded-kort bg-flate-2 p-4">
            <p className="radtittel text-blekk">Slik fungerer Medhold</p>
            <p className="mt-1 text-hjelp leading-relaxed text-dempet">
              Legg til brevet og sjekk tallene mot det. Vi kontrollerer gebyrer og
              frister, og lager et utkast du kan endre. Du sender det selv.
            </p>
          </div>
        </SekvensDel>
      )}
      </Sekvens>
    </Skjermramme>
  );
}
