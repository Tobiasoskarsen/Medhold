"use client";

import { useRef, useState } from "react";
import { slettDokumentNotat } from "@/app/saker/ai-actions";
import { formaterDato } from "@/lib/dato";
import type { BrevSamtaleMelding, DocumentNote } from "@/lib/types";

type Props = {
  notat: DocumentNote;
  startMeldinger: BrevSamtaleMelding[];
};

// Vanlige språk blant brukere som trenger hjelp med norske brev. Etiketten er
// på språkets eget skrift slik at den kjennes igjen uten å kunne norsk.
const SPRAK: { navn: string; etikett: string }[] = [
  { navn: "engelsk", etikett: "English" },
  { navn: "arabisk", etikett: "العربية" },
  { navn: "polsk", etikett: "Polski" },
  { navn: "somali", etikett: "Soomaali" },
  { navn: "ukrainsk", etikett: "Українська" },
  { navn: "tigrinja", etikett: "ትግርኛ" },
];

export default function DokumentNotat({ notat, startMeldinger }: Props) {
  const [meldinger, setMeldinger] =
    useState<BrevSamtaleMelding[]>(startMeldinger);
  const [streamendeSvar, setStreamendeSvar] = useState<string | null>(null);
  const [tekst, setTekst] = useState("");
  const [venter, setVenter] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const traadRef = useRef<HTMLDivElement>(null);

  function rull() {
    requestAnimationFrame(() => {
      traadRef.current?.scrollTo({ top: traadRef.current.scrollHeight });
    });
  }

  async function sendMelding(melding: string) {
    if (!melding || venter) return;

    setFeil(null);
    setVenter(true);
    setMeldinger((m) => [
      ...m,
      {
        id: `lokal-${Date.now()}`,
        document_note_id: notat.id,
        bruker_id: notat.bruker_id,
        rolle: "bruker",
        innhold: melding,
        opprettet: new Date().toISOString(),
      },
    ]);
    setStreamendeSvar("");
    rull();

    try {
      const res = await fetch("/api/brev-samtale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentNoteId: notat.id, melding }),
      });
      if (!res.ok || !res.body) throw new Error("svar feilet");

      const reader = res.body.getReader();
      const dekoder = new TextDecoder();
      let akk = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        akk += dekoder.decode(value, { stream: true });
        setStreamendeSvar(akk);
        rull();
      }

      setMeldinger((m) => [
        ...m,
        {
          id: `lokal-svar-${Date.now()}`,
          document_note_id: notat.id,
          bruker_id: notat.bruker_id,
          rolle: "assistent",
          innhold: akk,
          opprettet: new Date().toISOString(),
        },
      ]);
      setStreamendeSvar(null);
    } catch {
      setFeil("Noe gikk galt. Prøv igjen.");
      setStreamendeSvar(null);
    } finally {
      setVenter(false);
    }
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const melding = tekst.trim();
    if (!melding) return;
    setTekst("");
    void sendMelding(melding);
  }

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-sm font-medium text-slate-700">
          Forklaring fra {formaterDato(notat.opprettet)}
        </h3>
        <form action={slettDokumentNotat}>
          <input type="hidden" name="id" value={notat.id} />
          <input type="hidden" name="sak_id" value={notat.sak_id} />
          <button
            type="submit"
            className="shrink-0 text-sm text-slate-400 transition hover:text-red-600"
          >
            Slett
          </button>
        </form>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
        {notat.forklaring}
      </p>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-slate-400 transition hover:text-slate-600">
          Vis original brevtekst
        </summary>
        <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
          {notat.original_tekst}
        </p>
      </details>

      {/* ---- Oversett til et annet språk ---- */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500">
          Oversett / Translate:
        </span>
        {SPRAK.map((s) => (
          <button
            key={s.navn}
            type="button"
            disabled={venter}
            onClick={() =>
              void sendMelding(`Oversett forklaringen over til ${s.navn}.`)
            }
            className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {s.etikett}
          </button>
        ))}
      </div>

      {/* ---- Samtale ---- */}
      {(meldinger.length > 0 || streamendeSvar !== null) && (
        <div
          ref={traadRef}
          className="mt-4 flex max-h-96 flex-col gap-3 overflow-y-auto"
        >
          {meldinger.map((m) => (
            <Boble key={m.id} rolle={m.rolle} innhold={m.innhold} />
          ))}
          {streamendeSvar !== null && (
            <Boble rolle="assistent" innhold={streamendeSvar || "…"} />
          )}
        </div>
      )}

      {feil && <p className="mt-2 text-sm text-red-700">{feil}</p>}

      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          value={tekst}
          onChange={(e) => setTekst(e.target.value)}
          maxLength={4000}
          placeholder="Spør om dette brevet, f.eks. «oversett til engelsk»"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
        />
        <button
          type="submit"
          disabled={venter || !tekst.trim()}
          className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {venter ? "…" : "Send"}
        </button>
      </form>
    </li>
  );
}

function Boble({
  rolle,
  innhold,
}: {
  rolle: "bruker" | "assistent";
  innhold: string;
}) {
  const erBruker = rolle === "bruker";
  return (
    <div className={erBruker ? "flex justify-end" : "flex justify-start"}>
      <div
        dir="auto"
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
          erBruker ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"
        }`}
      >
        {innhold}
      </div>
    </div>
  );
}
