"use client";

import { useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";

type Melding = { rolle: "bruker" | "assistent"; innhold: string };

export function BrevSamtale({
  brevId,
  start,
}: {
  brevId: string;
  start: Melding[];
}) {
  const [meldinger, setMeldinger] = useState<Melding[]>(start);
  const [tekst, setTekst] = useState("");
  const [venter, setVenter] = useState(false);
  const bunn = useRef<HTMLDivElement | null>(null);

  async function send() {
    const m = tekst.trim();
    if (!m || venter) return;
    setTekst("");
    setMeldinger((p) => [
      ...p,
      { rolle: "bruker", innhold: m },
      { rolle: "assistent", innhold: "" },
    ]);
    setVenter(true);
    try {
      const res = await fetch("/api/brev-samtale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brevId, melding: m }),
      });
      if (!res.ok || !res.body) throw new Error();
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMeldinger((p) => {
          const c = [...p];
          c[c.length - 1] = { rolle: "assistent", innhold: acc };
          return c;
        });
        bunn.current?.scrollIntoView({ block: "end" });
      }
    } catch {
      setMeldinger((p) => {
        const c = [...p];
        c[c.length - 1] = {
          rolle: "assistent",
          innhold: "Beklager, noe gikk galt. Prøv igjen.",
        };
        return c;
      });
    } finally {
      setVenter(false);
    }
  }

  return (
    <div>
      {meldinger.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {meldinger.map((m, i) => (
            <div
              key={i}
              dir="auto"
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.rolle === "bruker"
                  ? "self-end bg-aksent text-white"
                  : "self-start border-[0.5px] border-strek bg-flate text-blekk"
              }`}
            >
              <p className="whitespace-pre-line">
                {m.innhold || (venter ? "…" : "")}
              </p>
            </div>
          ))}
          <div ref={bunn} />
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="mt-4 flex items-end gap-2"
      >
        <textarea
          value={tekst}
          onChange={(e) => setTekst(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder="Spør om noe i brevet …"
          className="flex-1 resize-none rounded-[10px] border-[0.5px] border-strek bg-flate px-3.5 py-2.5 text-sm text-blekk outline-none focus:border-aksent focus-visible:ring-2 focus-visible:ring-aksent/30"
        />
        <button
          type="submit"
          disabled={venter || !tekst.trim()}
          aria-label="Send"
          className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-aksent text-white transition hover:opacity-95 disabled:opacity-40"
        >
          <SendHorizontal className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}
