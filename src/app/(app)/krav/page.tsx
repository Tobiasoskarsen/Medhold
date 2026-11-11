import { Plus } from "lucide-react";
import { NavLenke as Link } from "@/components/NavLenke";
import { brukGruppering, saksGrupper } from "@/lib/oversikt";
import { createClient } from "@/lib/supabase/server";
import { Skjermramme, Primærknapp, Sekvens, SekvensDel } from "@/components/ui";
import { TomKonvolutt } from "@/components/illustrasjoner/TomKonvolutt";
import { AktivSaksliste } from "./AktivSaksliste";
import { AvsluttedeListe } from "./AvsluttedeListe";
import { GruppertSaksliste, type Gruppe, type GruppeRad } from "./GruppertSaksliste";
import { STADIUM_ETIKETT, type Stadium } from "@/lib/gjeld";
import { formaterBelop } from "@/lib/format";
import { dagerTil, idagOslo } from "@/lib/dato";
import { rangerSaker } from "@/lib/prioritet";
import { erHastende, fristChipTekst } from "@/lib/frist";
import { STATUS_ETIKETT, type SakStatus, type SakUtfall } from "@/lib/types";
import type { GebyrsjekkResultat } from "@/lib/gebyr";
import { sumavvikFra } from "@/lib/sumkontroll";
import type { HovedstolAvvik } from "@/lib/hovedstol-konsistens";

type SakRad = {
  id: string;
  kreditor: string | null;
  tittel: string;
  opprinnelig_kreditor: string | null;
  saksnummer: string | null;
  belop_totalt: number | null;
  stadium: Stadium | null;
  status: SakStatus;
  utfall: SakUtfall | null;
  sist_endret: string;
  hovedstol_avvik: HovedstolAvvik[] | null;
};

export default async function KravListePage() {
  const supabase = await createClient();

  const [{ data: sakData }, { data: fristData }, { data: brevData }] =
    await Promise.all([
      supabase
        .from("saker")
        .select(
          "id, kreditor, tittel, opprinnelig_kreditor, saksnummer, belop_totalt, stadium, status, utfall, sist_endret, hovedstol_avvik",
        )
        .order("sist_endret", { ascending: false }),
      supabase
        .from("frister")
        .select("sak_id, brev_id, forfallsdato")
        .eq("fullfort", false),
      // Nyeste brev per sak (kun for funn-markøren) — ÉN spørring, ingen N+1.
      supabase
        .from("brev")
        .select("id, sak_id, brevdato, opprettet, alvorlig, gebyrsjekk")
        .order("opprettet", { ascending: false }),
    ]);

  const saker = (sakData ?? []) as SakRad[];
  const frister = (fristData ?? []) as {
    sak_id: string;
    brev_id: string | null;
    forfallsdato: string;
  }[];
  const brevRader = (brevData ?? []) as {
    id: string;
    sak_id: string;
    brevdato: string | null;
    opprettet: string;
    alvorlig: boolean;
  }[];

  // Samme rangering som Hjem (lib/prioritet.ts). En gammel utløpt frist vises
  // ikke som «Frist utløpt», og drar ikke saken til toppen.
  const rangering = rangerSaker(saker, frister, brevRader, idagOslo());
  const rangPlass = new Map(rangering.map((r, i) => [r.sak.id, i]));
  const nesteFrist = new Map<string, string>();
  for (const r of rangering) {
    if (r.frist && r.klasse !== "historikk") nesteFrist.set(r.sak.id, r.frist.forfallsdato);
  }

  // Nyeste brev er først (DB-sortert) → første treff per sak_id holdes.
  const harFunnPerSak = new Map<string, boolean>();
  for (const b of brevData ?? []) {
    if (harFunnPerSak.has(b.sak_id)) continue;
    const gs = b.gebyrsjekk as GebyrsjekkResultat | null;
    // §-markøren gjelder både gebyrfunn og sumavvik (Del B.2).
    harFunnPerSak.set(
      b.sak_id,
      !!gs?.linjer.some((l) => l.vurdering === "over") || sumavvikFra(gs) !== null,
    );
  }

  // Nærmeste åpne frist først; saker uten frist etter, sortert på sist_endret
  // (stabil sort — sakene er allerede i sist_endret-rekkefølge fra spørringen).
  const etterFrist = (a: SakRad, b: SakRad) => {
    const fa = nesteFrist.get(a.id);
    const fb = nesteFrist.get(b.id);
    if (fa && fb) return fa < fb ? -1 : 1;
    if (fa) return -1;
    if (fb) return 1;
    return 0;
  };
  const { trengerHandling, venter, avsluttet: avsluttede } = saksGrupper(saker);
  const aktiveSortert = [...trengerHandling].sort(
    (a, b) => (rangPlass.get(a.id) ?? 0) - (rangPlass.get(b.id) ?? 0),
  );
  const venterSortert = [...venter].sort(etterFrist);

  function kortData(sak: SakRad) {
    return {
      id: sak.id,
      navn: sak.kreditor ?? sak.tittel,
      saksnummer: sak.saksnummer,
      delNavn: !sak.opprinnelig_kreditor,
      belop: formaterBelop(sak.belop_totalt),
      stadiumEtikett: sak.stadium ? STADIUM_ETIKETT[sak.stadium] : null,
      frist: nesteFrist.get(sak.id) ?? null,
      status: sak.status,
      utfall: sak.utfall,
      harFunn: harFunnPerSak.get(sak.id) ?? false,
      harHovedstolAvvik: (sak.hovedstol_avvik?.length ?? 0) > 0,
    };
  }

  // Gruppert visning (kun brukt over terskelen, se lenger ned): raden inni
  // en åpnet gruppe. Kreditornavnet er allerede gruppens overskrift, så
  // radens egen tittel er saksnummeret når det finnes, ellers stadiet.
  function gruppeRad(sak: SakRad): GruppeRad {
    const frist = nesteFrist.get(sak.id) ?? null;
    const dagerIgjen = frist ? dagerTil(frist) : null;
    const hastende = dagerIgjen != null && erHastende(dagerIgjen);
    const stadiumTekst = sak.stadium ? STADIUM_ETIKETT[sak.stadium] : null;
    const fristTekst = dagerIgjen != null ? fristChipTekst(dagerIgjen) : null;
    const tittel = sak.saksnummer
      ? `Sak #${sak.saksnummer}`
      : (stadiumTekst ?? "Krav");
    const underDeler = sak.saksnummer
      ? [stadiumTekst, fristTekst].filter(Boolean)
      : [
          fristTekst ??
            (sak.status === "venter_pa_svar"
              ? STATUS_ETIKETT.venter_pa_svar
              : null),
        ].filter(Boolean);
    return {
      id: sak.id,
      tittel,
      underTekst: underDeler.length > 0 ? (underDeler.join(" · ") as string) : null,
      hastende,
      belop: sak.belop_totalt,
      harFunn: harFunnPerSak.get(sak.id) ?? false,
    };
  }

  // Gruppering på kreditor (§ mockup «gruppert saksliste») — kun over
  // GRUPPERING_TERSKEL saker som trenger handling. Rekkefølgen inni hver gruppe arves fra
  // aktiveSortert (nærmeste frist først); selve gruppene sorteres på samlet
  // beløp (høyest øverst).
  const gruppert = brukGruppering(trengerHandling.length);
  const grupper: Gruppe[] = [];
  const enkeltstaendeSaker: SakRad[] = [];
  if (gruppert) {
    const perKreditor = new Map<string, SakRad[]>();
    for (const sak of aktiveSortert) {
      const navn = sak.kreditor ?? sak.tittel;
      const liste = perKreditor.get(navn);
      if (liste) liste.push(sak);
      else perKreditor.set(navn, [sak]);
    }
    for (const [navn, liste] of perKreditor) {
      if (liste.length === 1) {
        enkeltstaendeSaker.push(liste[0]);
        continue;
      }
      const rader = liste.map(gruppeRad);
      const samletBelop = liste.reduce(
        (sum, s) => sum + (s.belop_totalt ?? 0),
        0,
      );
      let minDager: number | null = null;
      for (const s of liste) {
        const f = nesteFrist.get(s.id);
        if (!f) continue;
        const d = dagerTil(f);
        if (minDager == null || d < minDager) minDager = d;
      }
      grupper.push({
        navn,
        saker: rader,
        samletBelop: samletBelop > 0 ? samletBelop : null,
        harFunn: rader.some((r) => r.harFunn),
        fristTekst:
          minDager != null && erHastende(minDager)
            ? fristChipTekst(minDager)
            : null,
      });
    }
    grupper.sort((a, b) => (b.samletBelop ?? 0) - (a.samletBelop ?? 0));
  }
  const antallKreditorer = grupper.length + enkeltstaendeSaker.length;


  return (
    <Skjermramme className="pt-6" animerInn={false}>
      <Sekvens>
      <SekvensDel>
      <h1 className="tittel text-blekk">Saker</h1>
      </SekvensDel>

      {saker.length === 0 && (
        <SekvensDel>
          <div className="mt-seksjon flex flex-col items-center px-4 text-center">
            <TomKonvolutt className="size-20 text-blekk" />
            <p className="seksjonstittel mt-4 text-blekk">Ingen saker ennå</p>
            <p className="mt-1.5 text-brod leading-relaxed text-dempet">
              Legg inn ditt første brev, så holder Medhold oversikten.
            </p>
            <div className="mt-5 w-full">
              <Primærknapp href="/legg-til-brev">Legg til brev</Primærknapp>
            </div>
          </div>
        </SekvensDel>
      )}
      {trengerHandling.length > 0 && (
        <SekvensDel>
          <div className="mt-6">
            <h2 className="seksjonstittel mb-gruppe text-blekk">Trenger handling</h2>
            {gruppert ? (
              <GruppertSaksliste
                grupper={grupper}
                enkeltstaende={enkeltstaendeSaker.map(kortData)}
                antallKreditorer={antallKreditorer}
              />
            ) : (
              <AktivSaksliste
                gruppe="trenger handling"
                saker={aktiveSortert.map(kortData)}
              />
            )}
          </div>
        </SekvensDel>
      )}
      {venterSortert.length > 0 && (
        <SekvensDel>
          <div className="mt-seksjon">
            <h2 className="seksjonstittel mb-gruppe text-blekk">Venter på svar</h2>
            <AktivSaksliste
              gruppe="venter på svar"
              saker={venterSortert.map(kortData)}
            />
          </div>
        </SekvensDel>
      )}
      {avsluttede.length > 0 && (
        <SekvensDel>
          <div className="mt-seksjon">
            <h2 className="seksjonstittel mb-gruppe text-blekk">Avsluttet</h2>
            <AvsluttedeListe saker={avsluttede.map(kortData)} />
          </div>
        </SekvensDel>
      )}
      </Sekvens>

      <div className="mt-5 flex justify-center">
        <Link
          href="/krav/ny"
          className="trykk flex min-h-11 items-center gap-1.5 px-2 text-hjelp font-medium text-dempet transition hover:text-blekk"
        >
          <Plus className="size-4" aria-hidden />
          Opprett krav manuelt
        </Link>
      </div>
    </Skjermramme>
  );
}
