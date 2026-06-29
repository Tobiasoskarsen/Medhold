import Anthropic from "@anthropic-ai/sdk";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// AI-svar (særlig oversettelser) kan ta tid å strømme — gi funksjonen rom
// på Vercel slik at den ikke kuttes av standard-timeouten.
export const maxDuration = 60;

const SYSTEM = `Du hjelper en person som står i en vanskelig livssituasjon med å forstå et brev de har fått. De har allerede fått en forklaring av brevet, og stiller nå oppfølgingsspørsmål (for eksempel be om oversettelse til et annet språk, eller at noe forklares enklere).

Regler:
- Svar på enkelt, varmt norsk (bokmål) — MED MINDRE brukeren ber om et annet språk (f.eks. «oversett til engelsk»); da svarer du på det språket.
- Du forklarer og hjelper, men gir ALDRI juridiske, medisinske eller økonomiske vedtak, konklusjoner eller garantier.
- Finn ALDRI opp fakta, frister, beløp eller paragrafer som ikke står i brevet eller samtalen. Er noe uklart, si det heller.
- Hold deg til brevet og det brukeren spør om.
- Når du gir konkrete råd om hva de bør gjøre, minn kort om at dette ikke er profesjonell rådgivning, og at viktige ting bør bekreftes med rett instans (NAV, lege, advokat, kommune).`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Ikke innlogget", { status: 401 });

  let body: { documentNoteId?: string; melding?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Ugyldig forespørsel", { status: 400 });
  }

  const documentNoteId = String(body.documentNoteId ?? "");
  const melding = String(body.melding ?? "").trim();
  if (!documentNoteId || !melding) {
    return new Response("Mangler data", { status: 400 });
  }
  if (melding.length > 4000) {
    return new Response("Meldingen er for lang", { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response("AI er ikke konfigurert", { status: 503 });
  }

  // Hent brevet + den opprinnelige forklaringen (RLS sikrer eierskap).
  const { data: note } = await supabase
    .from("document_note")
    .select("original_tekst, forklaring")
    .eq("id", documentNoteId)
    .maybeSingle();
  if (!note) return new Response("Fant ikke brevet", { status: 404 });

  const { data: tidligere } = await supabase
    .from("brev_samtale")
    .select("rolle, innhold")
    .eq("document_note_id", documentNoteId)
    .order("opprettet", { ascending: true });

  // Lagre brukermeldingen før vi svarer.
  await supabase.from("brev_samtale").insert({
    document_note_id: documentNoteId,
    bruker_id: user.id,
    rolle: "bruker",
    innhold: melding,
  });

  // Bygg samtalen: brevet + forklaringen som kontekst, så tråden, så ny melding.
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Her er teksten fra brevet:\n\n${note.original_tekst}`,
    },
    { role: "assistant", content: note.forklaring },
    ...(tidligere ?? []).map((m) => ({
      role: (m.rolle === "bruker" ? "user" : "assistant") as
        | "user"
        | "assistant",
      content: m.innhold,
    })),
    { role: "user", content: melding },
  ];

  const anthropic = new Anthropic();
  const encoder = new TextEncoder();
  let fullt = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 4000,
          thinking: { type: "disabled" },
          system: SYSTEM,
          messages,
        });
        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            fullt += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch {
        controller.enqueue(
          encoder.encode("\n\n[Beklager, noe gikk galt. Prøv igjen.]"),
        );
      } finally {
        if (fullt.trim()) {
          await supabase.from("brev_samtale").insert({
            document_note_id: documentNoteId,
            bruker_id: user.id,
            rolle: "assistent",
            innhold: fullt,
          });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
