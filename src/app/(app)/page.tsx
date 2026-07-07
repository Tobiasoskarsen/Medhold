import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Logo from "@/components/Logo";
import { Skjermramme, Kort, Primærknapp, Pill } from "@/components/ui";
import { formaterKortDato, fristNærhet } from "@/lib/dato";
import { formaterBelop } from "@/lib/format";
import { handlingstittel, stotterUtkast, type Stadium } from "@/lib/gjeld";

type SakKobling = {
  id: string;
  kreditor: string | null;
  tittel: string;
  belop_totalt: number | null;
  stadium: Stadium | null;
};

type AapenFrist = {
  id: string;
  sak_id: string;
  tittel: string;
  forfallsdato: string;
  saker: SakKobling | null;
};

export default async function HjemPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: sakData }, { data: fristData }] = await Promise.all([
    supabase
      .from("saker")
      .select("id, kreditor, tittel, belop_totalt, stadium, sist_endret")
      .order("sist_endret", { ascending: false }),
    supabase
      .from("frister")
      .select("id, sak_id, tittel, forfallsdato, saker(id, kreditor, tittel, belop_totalt, stadium)")
      .eq("fullfort", false),
  ]);

  const saker = (sakData ?? []) as (SakKobling & { sist_endret: string })[];
  const frister = (fristData ?? []) as unknown as AapenFrist[];

  // Prioritering: nærmeste frist på tvers av alle krav; ved likhet, størst beløp.
  frister.sort((a, b) => {
    if (a.forfallsdato !== b.forfallsdato)
      return a.forfallsdato < b.forfallsdato ? -1 : 1;
    return (b.saker?.belop_totalt ?? 0) - (a.saker?.belop_totalt ?? 0);
  });

  const fornavn = (user?.user_metadata?.fornavn as string | undefined)
    ?.split(" ")[0]
    ?.trim();

  const harKrav = saker.length > 0;
  const topFrist = frister[0] ?? null;
  const topSak = topFrist?.saker ?? saker[0] ?? null;
  const kommende = frister.slice(topFrist ? 1 : 0, topFrist ? 4 : 3);

  return (
    <Skjermramme className="pt-6">
      <div className="mb-4">
        <Logo />
      </div>

      {fornavn && <p className="text-[13px] text-dempet">Hei, {fornavn}</p>}
      <h1 className="mt-1 text-[21px] font-medium tracking-[-0.3px] text-blekk">
        {harKrav ? "Det viktigste nå" : "Kom i gang"}
      </h1>

      {!harKrav ? (
        <Kort className="mt-4">
          <p className="text-[15px] leading-relaxed text-blekk">
            Legg inn ditt første brev, så holder Medhold oversikten.
          </p>
          <div className="mt-4">
            <Primærknapp href="/legg-til-brev">Legg til brev</Primærknapp>
          </div>
        </Kort>
      ) : (
        <>
          <Kort className="mt-4">
            {topFrist && (
              <Pill variant="varsel">
                Frist {fristNærhet(topFrist.forfallsdato).toLowerCase()}
              </Pill>
            )}
            <p className="mt-3 text-[17px] font-medium text-blekk">
              {handlingstittel(topSak?.stadium ?? null)}
            </p>
            <p className="mt-0.5 text-[13px] text-dempet">
              {[
                topSak?.kreditor ?? topSak?.tittel,
                topSak?.belop_totalt != null
                  ? `${formaterBelop(topSak.belop_totalt)} kr`
                  : null,
                topFrist ? `frist ${formaterKortDato(topFrist.forfallsdato)}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
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
                  <Primærknapp href={`/krav/${topSak.id}`}>Se saken</Primærknapp>
                </div>
              ))}
          </Kort>

          {kommende.length > 0 && (
            <>
              <p className="mb-1 mt-6 text-xs font-medium tracking-[0.4px] text-dempet">
                KOMMENDE
              </p>
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
            </>
          )}
        </>
      )}
    </Skjermramme>
  );
}
