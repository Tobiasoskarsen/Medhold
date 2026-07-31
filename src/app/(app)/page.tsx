import type { ReactNode } from "react";
import { NavLenke as Link } from "@/components/NavLenke";
import { createClient } from "@/lib/supabase/server";
import {
  Skjermramme,
  Kort,
  Primærknapp,
  Belop,
  Trapp,
  Sekvens,
  SekvensDel,
} from "@/components/ui";
import { FristChip } from "./FristChip";
import { formaterKortDato, fristNærhet } from "@/lib/dato";
import { handlingstittel, stotterUtkast, type Stadium } from "@/lib/gjeld";
import type { SakStatus, SakUtfall } from "@/lib/types";
import type { GebyrsjekkResultat } from "@/lib/gebyr";
import { beregnOversikt, type SakOppsummering } from "@/lib/oversikt";
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
  tittel: string;
  forfallsdato: string;
  saker: SakKobling | null;
};

/** Dagens dato som eyebrow: «Torsdag 16. juli» (norsk tid — se dato.ts). */
function idagEyebrow(): string {
  const s = new Date().toLocaleDateString("nb-NO", {
    timeZone: "Europe/Oslo",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Deterministisk H1 (designordre §3.1) — [tekst, siste ledd]. Siste ledd
 * settes i kursiv serif. Ren kode, ingen AI.
 */
function hjemH1(
  aktive: number,
  antallFrister: number,
  handlingUtfort: boolean,
  harLoste: boolean,
): [string, string] {
  if (aktive === 0) {
    return harLoste
      ? ["Ingen aktive saker.", "Godt jobbet."]
      : ["Ett brev om gangen.", "Vi tar det rolig."];
  }
  const ord = aktive === 1 ? "sak" : "saker";
  if (antallFrister > 0) {
    const fristLedd = antallFrister === 1 ? "Én frist." : `${antallFrister} frister.`;
    return [
      `${aktive} ${ord}. ${fristLedd}`,
      handlingUtfort ? "Du ligger foran." : "Neste steg er klart.",
    ];
  }
  return [`${aktive} ${ord}.`, "Alt under kontroll."];
}

/**
 * Ventetid som synlig aktivitet (§5), kortform på Hjem sitt handlingskort —
 * inkassoselskapet nevnes ikke her (står alt i tittelen «Venter på svar fra
 * {kreditor}»). Er e-postpåminnelser av, loves ingen e-post appen ikke
 * sender.
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
          "id, sak_id, tittel, forfallsdato, saker(id, kreditor, tittel, belop_totalt, stadium, status, utfall)",
        )
        .eq("fullfort", false),
      // Nyeste brev per sak (gebyrsjekk-summeringen + alvorsgrensen, §B.5) —
      // ÉN spørring, ingen N+1, samme mønster som /krav (Kravkort sin
      // §-markør).
      supabase
        .from("brev")
        .select("sak_id, opprettet, gebyrsjekk, alvorlig")
        .order("opprettet", { ascending: false }),
    ]);

  const saker = (sakData ?? []) as (SakKobling & { sist_endret: string })[];
  // Verken markerLost eller markerUtkastSendt lukker sakens åpne frister
  // automatisk når status endres (til fullfort/venter_pa_svar) — filtrer
  // bort frister som tilhører en sak som ikke lenger er aktiv, så Hjem ikke
  // lar en gjenglemt frist overstyre «venter på svar»-kortet eller dra en
  // løst sak tilbake på forsidekortet.
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
  const aktive = aktiveSaker.length;
  const harLoste = saker.some((s) => s.status === "fullfort");

  // Nyeste brev sin gebyrsjekk/alvorlighet per sak (DB-sortert nyeste først
  // → første treff per sak_id holdes) — grunnlaget for oversiktspanelet og
  // alvorsvarselet (§B.5) under.
  const gebyrsjekkPerSak = new Map<string, GebyrsjekkResultat | null>();
  const alvorligPerSak = new Map<string, boolean>();
  for (const b of brevData ?? []) {
    if (gebyrsjekkPerSak.has(b.sak_id)) continue;
    gebyrsjekkPerSak.set(
      b.sak_id,
      (b.gebyrsjekk as GebyrsjekkResultat | null) ?? null,
    );
    alvorligPerSak.set(b.sak_id, !!b.alvorlig);
  }
  const sakOppsummeringer: SakOppsummering[] = saker.map((s) => ({
    id: s.id,
    status: s.status,
    utfall: s.utfall ?? null,
    belopTotalt: s.belop_totalt,
    gebyrsjekk: gebyrsjekkPerSak.get(s.id) ?? null,
  }));
  const oversikt = beregnOversikt(sakOppsummeringer);
  const historikkLedd = [
    oversikt.antallMedhold > 0 ? `${oversikt.antallMedhold} medhold` : null,
    oversikt.antallAvtale > 0 ? `${oversikt.antallAvtale} avtaler` : null,
    oversikt.antallOppgjort > 0 ? `${oversikt.antallOppgjort} oppgjort` : null,
  ].filter(Boolean);
  const topFrist = frister[0] ?? null;
  const topSak = topFrist?.saker ?? aktiveSaker[0] ?? null;
  const kommende = frister.slice(topFrist ? 1 : 0, topFrist ? 4 : 3);
  const venter = !!topSak && topSak.status === "venter_pa_svar" && !topFrist;
  const topSakAlvorlig = topSak ? (alvorligPerSak.get(topSak.id) ?? false) : false;

  // Ventetid som synlig aktivitet (§5), kortform på handlingskortet. Samme
  // definisjon av «siste aktivitet» som krav-detalj/cron-en: nyeste av
  // (utkast.sendt_at, brev.opprettet).
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

  const [h1Tekst, h1Ledd] = hjemH1(
    aktive,
    frister.length,
    topSak?.status === "venter_pa_svar",
    harLoste,
  );

  // Seier: nyeste sak er løst med medhold, og ingen presserende frist.
  const seierSak =
    !topFrist &&
    saker[0]?.status === "fullfort" &&
    saker[0]?.utfall === "medhold"
      ? saker[0]
      : null;

  // Gebyrsjekk-hint på handlingskortet (uendret logikk).
  let hjemHarOverGebyr = false;
  if (topSak && stotterUtkast(topSak.stadium ?? null)) {
    const { data: nyesteBrev } = await supabase
      .from("brev")
      .select("gebyrsjekk")
      .eq("sak_id", topSak.id)
      .order("brevdato", { ascending: false, nullsFirst: false })
      .order("opprettet", { ascending: false })
      .limit(1)
      .maybeSingle();
    hjemHarOverGebyr =
      ((nyesteBrev?.gebyrsjekk as GebyrsjekkResultat | null)?.antallOver ?? 0) > 0;
  }

  return (
    <Skjermramme className="pt-6" animerInn={false}>
      <Sekvens>
      <SekvensDel>
      <p className="eyebrow mb-2">{idagEyebrow()}</p>
      <h1 className="font-serif text-[30px] font-medium leading-[1.15] tracking-[-0.01em] text-blekk">
        {h1Tekst}{" "}
        <em className="italic text-aksent-dyp">{h1Ledd}</em>
      </h1>
      </SekvensDel>

      {oversikt.antallAktive > 0 && (
        <SekvensDel>
          <Kort className="mt-5">
            <div className="flex items-stretch text-center">
              <div className="flex-1">
                <p className="font-serif text-[22px] font-medium tabular-nums text-blekk">
                  {oversikt.antallAktive}
                </p>
                <p className="eyebrow mt-1">aktive saker</p>
              </div>
              <div className="w-px bg-strek" />
              <div className="flex-1">
                <Belop
                  verdi={oversikt.samletKravAktive}
                  className="font-serif text-[22px] font-medium tabular-nums text-blekk"
                />
                <p className="eyebrow mt-1">samlet krav</p>
              </div>
              {oversikt.funnetOverSats > 0 && (
                <>
                  <div className="w-px bg-strek" />
                  <div className="flex-1">
                    <Belop
                      verdi={oversikt.funnetOverSats}
                      className="font-serif text-[22px] font-medium tabular-nums text-dom-rod"
                    />
                    <p className="eyebrow mt-1">over lovlig sats</p>
                  </div>
                </>
              )}
            </div>
          </Kort>
          {historikkLedd.length > 0 && (
            <p className="mt-2 text-center text-[12px] text-dempet">
              Så langt: {historikkLedd.join(" · ")}
            </p>
          )}
        </SekvensDel>
      )}

      <SekvensDel>
      {!harKrav ? (
        <Kort className="mt-6">
          <p className="text-[15px] leading-relaxed text-blekk">
            Legg inn ditt første brev, så holder Medhold oversikten.
          </p>
          <div className="mt-4">
            <Primærknapp href="/legg-til-brev">Legg til brev</Primærknapp>
          </div>
        </Kort>
      ) : seierSak ? (
        <div className="mt-6 flex items-center gap-3.5 rounded-2xl border-[0.5px] border-gull/40 bg-gull-bg px-4 py-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gull font-serif text-[22px] font-semibold text-white">
            ✓
          </span>
          <div>
            <p className="font-serif text-[18px] font-semibold text-gull">
              Medhold.
            </p>
            <p className="mt-0.5 text-[13px] text-blekk">
              {seierSak.kreditor ?? seierSak.tittel} — kravet ble frafalt etter
              innsigelsen din. Saken er lukket.
            </p>
          </div>
        </div>
      ) : !topSak ? (
        <Kort className="mt-6">
          <p className="text-[15px] leading-relaxed text-blekk">
            Ingen aktive saker akkurat nå. Godt jobbet.
          </p>
        </Kort>
      ) : (
          <Kort className="mt-6">
            {topSakAlvorlig ? (
              <>
                <p className="text-[17px] font-medium text-blekk">
                  {topSak?.kreditor ?? topSak?.tittel}
                </p>
                <p className="mt-0.5 text-[13px] font-medium text-dom-rod">
                  Alvorlig varsel — søk hjelp
                </p>
                {topSak?.belop_totalt != null && (
                  <p className="mt-2">
                    <Belop
                      verdi={topSak.belop_totalt}
                      className="font-serif text-[30px] font-medium tracking-[-0.02em] tabular-nums text-blekk"
                    />
                  </p>
                )}
                {topSak && (
                  <p className="mt-3 text-center text-[13px] text-dempet">
                    <Link
                      href={`/krav/${topSak.id}`}
                      className="transition hover:text-blekk"
                    >
                      Se hele saken
                    </Link>
                  </p>
                )}
              </>
            ) : venter ? (
              <>
                <p className="text-[17px] font-medium text-blekk">
                  Venter på svar
                  {topSak?.kreditor ? ` fra ${topSak.kreditor}` : ""}
                </p>
                <p className="mt-0.5 text-[13px] text-dempet">
                  {oppfolgingTilstandVerdi
                    ? oppfolgingTekstKort(oppfolgingTilstandVerdi, varslerPa)
                    : "Ta vare på kvitteringen på at du sendte det."}
                </p>
                <div className="mt-4">
                  <Primærknapp href="/legg-til-brev">
                    Fått svar? Legg til brevet
                  </Primærknapp>
                </div>
                {topSak && (
                  <p className="mt-3 text-center text-[13px] text-dempet">
                    <Link
                      href={`/krav/${topSak.id}`}
                      className="transition hover:text-blekk"
                    >
                      Se hele saken
                    </Link>
                  </p>
                )}
              </>
            ) : (
              <>
                {topFrist && (
                  <FristChip>
                    Frist {fristNærhet(topFrist.forfallsdato).toLowerCase()}
                  </FristChip>
                )}
                <p className="mt-3 text-[17px] font-medium text-blekk">
                  {handlingstittel(topSak?.stadium ?? null)}
                </p>
                <p className="mt-0.5 text-[13px] text-dempet">
                  {(() => {
                    const deler: ReactNode[] = [];
                    const navn = topSak?.kreditor ?? topSak?.tittel;
                    if (navn) deler.push(navn);
                    if (topFrist)
                      deler.push(
                        `frist ${formaterKortDato(topFrist.forfallsdato)}`,
                      );
                    return deler.map((d, i) => (
                      <span key={i}>
                        {i > 0 ? " · " : ""}
                        {d}
                      </span>
                    ));
                  })()}
                </p>
                {topSak?.belop_totalt != null && (
                  <p className="mt-2">
                    <Belop
                      verdi={topSak.belop_totalt}
                      className="font-serif text-[30px] font-medium tracking-[-0.02em] tabular-nums text-blekk"
                    />
                  </p>
                )}
                {hjemHarOverGebyr && (
                  <p className="mt-1 text-[13px] text-dempet">
                    Gebyrsjekken fant et beløp over maksimalsats — god grunn til
                    å svare.
                  </p>
                )}
                {topSak?.stadium && (
                  <div className="mt-4">
                    <Trapp stadium={topSak.stadium} kompakt />
                  </div>
                )}
                {topSak &&
                  (stotterUtkast(topSak.stadium ?? null) ? (
                    <>
                      <div className="mt-4">
                        <Primærknapp href={`/krav/${topSak.id}/utkast`}>
                          Lag utkast til svar
                        </Primærknapp>
                      </div>
                      <p className="mt-3 text-center text-[13px] text-dempet">
                        <Link
                          href={`/krav/${topSak.id}`}
                          className="transition hover:text-blekk"
                        >
                          Se hele saken
                        </Link>
                      </p>
                    </>
                  ) : (
                    <div className="mt-4">
                      <Primærknapp href={`/krav/${topSak.id}`}>
                        Se saken
                      </Primærknapp>
                    </div>
                  ))}
              </>
            )}
          </Kort>
      )}
      </SekvensDel>

      {harKrav && !seierSak && topSak && kommende.length > 0 && (
        <SekvensDel>
          <p className="eyebrow mb-1 mt-6">Kommende</p>
          <ul>
            {kommende.map((f, i) => (
              <li
                key={f.id}
                className={`flex items-center gap-2.5 py-[11px] ${
                  i < kommende.length - 1 ? "border-b-[0.5px] border-strek" : ""
                }`}
              >
                <span className="min-w-[46px] text-xs text-dempet">
                  {formaterKortDato(f.forfallsdato)}
                </span>
                <span className="text-sm text-blekk">
                  {f.tittel}
                  {f.saker?.kreditor ? ` — ${f.saker.kreditor}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </SekvensDel>
      )}
      </Sekvens>
    </Skjermramme>
  );
}
