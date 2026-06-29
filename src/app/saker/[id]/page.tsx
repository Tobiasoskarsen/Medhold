import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KategoriMerke, StatusMerke } from "@/components/Merker";
import AutoSubmitAvkryssing from "@/components/AutoSubmitAvkryssing";
import LeggTilFristSkjema from "@/components/LeggTilFristSkjema";
import LeggTilStegSkjema from "@/components/LeggTilStegSkjema";
import AiBrevhjelp from "@/components/AiBrevhjelp";
import DokumentNotat from "@/components/DokumentNotat";
import { slettSak } from "@/app/saker/actions";
import {
  leggTilFrist,
  leggTilSteg,
  settFristFullfort,
  settStegFullfort,
  slettFrist,
  slettSteg,
} from "@/app/saker/frister-steg-actions";
import { formaterDato, fristNærhet, hastegrad, HASTEGRAD_STIL } from "@/lib/dato";
import type {
  BrevSamtaleMelding,
  DocumentNote,
  Frist,
  NesteSteg,
  Sak,
} from "@/lib/types";

// Gi AI-server-actions (brevforklaring) rom på Vercel.
export const maxDuration = 60;

export default async function SakDetaljPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("saker")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();
  const sak = data as Sak;

  const [{ data: fristData }, { data: stegData }, { data: notatData }] =
    await Promise.all([
      supabase
        .from("frister")
        .select("*")
        .eq("sak_id", id)
        .order("fullfort", { ascending: true })
        .order("forfallsdato", { ascending: true }),
      supabase
        .from("neste_steg")
        .select("*")
        .eq("sak_id", id)
        .order("rekkefolge", { ascending: true })
        .order("opprettet", { ascending: true }),
      supabase
        .from("document_note")
        .select("*")
        .eq("sak_id", id)
        .order("opprettet", { ascending: false }),
    ]);
  const frister = (fristData ?? []) as Frist[];
  const steg = (stegData ?? []) as NesteSteg[];
  const notater = (notatData ?? []) as DocumentNote[];

  // Hent samtale-meldinger for alle brevforklaringene på saken.
  const noteIds = notater.map((n) => n.id);
  const { data: samtaleData } = noteIds.length
    ? await supabase
        .from("brev_samtale")
        .select("*")
        .in("document_note_id", noteIds)
        .order("opprettet", { ascending: true })
    : { data: [] };
  const samtaler = (samtaleData ?? []) as BrevSamtaleMelding[];

  // Bind sak-id til skjema-handlingene.
  const leggTilFristHandling = leggTilFrist.bind(null, sak.id);
  const leggTilStegHandling = leggTilSteg.bind(null, sak.id);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <Link
        href="/saker"
        className="text-sm text-slate-500 transition hover:text-slate-800"
      >
        ← Tilbake til saker
      </Link>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {sak.tittel}
          </h1>
          <Link
            href={`/saker/${sak.id}/rediger`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Rediger
          </Link>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <StatusMerke status={sak.status} />
          <KategoriMerke kategori={sak.kategori} />
        </div>

        {sak.beskrivelse ? (
          <p className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {sak.beskrivelse}
          </p>
        ) : (
          <p className="mt-6 text-sm italic text-slate-400">
            Ingen beskrivelse lagt til.
          </p>
        )}
      </div>

      {/* ============ FRISTER ============ */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Frister</h2>

        {frister.length > 0 ? (
          <ul className="mb-4 flex flex-col gap-2">
            {frister.map((frist) => (
              <li
                key={frist.id}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4"
              >
                <AutoSubmitAvkryssing
                  handling={settFristFullfort}
                  id={frist.id}
                  sakId={sak.id}
                  fullfort={frist.fullfort}
                  ariaLabel={`Marker «${frist.tittel}» som fullført`}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`font-medium ${
                      frist.fullfort
                        ? "text-slate-400 line-through"
                        : "text-slate-900"
                    }`}
                  >
                    {frist.tittel}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-slate-500">
                      {formaterDato(frist.forfallsdato)}
                    </span>
                    {!frist.fullfort && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          HASTEGRAD_STIL[hastegrad(frist.forfallsdato)]
                        }`}
                      >
                        {fristNærhet(frist.forfallsdato)}
                      </span>
                    )}
                  </div>
                  {frist.notat && (
                    <p className="mt-1 text-sm text-slate-500">{frist.notat}</p>
                  )}
                </div>
                <form action={slettFrist}>
                  <input type="hidden" name="id" value={frist.id} />
                  <input type="hidden" name="sak_id" value={sak.id} />
                  <button
                    type="submit"
                    aria-label="Slett frist"
                    className="text-sm text-slate-400 transition hover:text-red-600"
                  >
                    Slett
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-slate-500">
            Ingen frister lagt til ennå.
          </p>
        )}

        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <LeggTilFristSkjema handling={leggTilFristHandling} />
        </div>
      </section>

      {/* ============ NESTE STEG ============ */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Neste steg</h2>

        {steg.length > 0 ? (
          <ul className="mb-4 flex flex-col gap-2">
            {steg.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5"
              >
                <AutoSubmitAvkryssing
                  handling={settStegFullfort}
                  id={s.id}
                  sakId={sak.id}
                  fullfort={s.fullfort}
                  ariaLabel={`Marker «${s.tekst}» som fullført`}
                />
                <p
                  className={`min-w-0 flex-1 text-sm ${
                    s.fullfort
                      ? "text-slate-400 line-through"
                      : "text-slate-800"
                  }`}
                >
                  {s.tekst}
                </p>
                <form action={slettSteg}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="sak_id" value={sak.id} />
                  <button
                    type="submit"
                    aria-label="Slett steg"
                    className="text-sm text-slate-400 transition hover:text-red-600"
                  >
                    Slett
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-slate-500">
            Ingen steg lagt til ennå. Del saken opp i små, konkrete handlinger.
          </p>
        )}

        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <LeggTilStegSkjema handling={leggTilStegHandling} />
        </div>
      </section>

      {/* ============ AI-HJELP ============ */}
      <AiBrevhjelp sakId={sak.id} />

      {notater.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-1 text-lg font-semibold text-slate-900">
            Tidligere forklaringer
          </h2>
          <p className="mb-3 text-sm text-slate-500">
            Still oppfølgingsspørsmål til hvert brev — be om oversettelse, eller
            at noe forklares enklere.
          </p>
          <ul className="flex flex-col gap-3">
            {notater.map((notat) => (
              <DokumentNotat
                key={notat.id}
                notat={notat}
                startMeldinger={samtaler.filter(
                  (s) => s.document_note_id === notat.id,
                )}
              />
            ))}
          </ul>
        </section>
      )}

      <form action={slettSak} className="mt-10">
        <input type="hidden" name="id" value={sak.id} />
        <button
          type="submit"
          className="text-sm font-medium text-red-600 transition hover:text-red-700"
        >
          Slett denne saken
        </button>
      </form>
    </div>
  );
}
