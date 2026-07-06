import Anthropic from "@anthropic-ai/sdk";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { STADIUM_ETIKETT, type Stadium } from "@/lib/gjeld";
import { formaterKortDato } from "@/lib/dato";

// AI-svar kan ta tid å strømme — gi funksjonen rom på Vercel.
export const maxDuration = 60;

const SYSTEM_BASE = `Du hjelper en person som har fått et brev om gjeld/inkasso og stiller oppfølgingsspørsmål. De har allerede fått en forklaring av brevet.

Regler:
- Svar på enkelt, varmt norsk (bokmål) — MED MINDRE brukeren ber om et annet språk; da svarer du på det.
- Du forklarer og hjelper, men gir ALDRI juridiske eller økonomiske vedtak, konklusjoner eller garantier.
- Finn ALDRI opp fakta, frister, beløp eller paragrafer som ikke står i brevet, saken eller samtalen. Er noe uklart, si det heller.
- Hold deg til saken og det brukeren spør om.
- Når du gir konkrete råd, minn kort om at dette ikke er profesjonell rådgivning, og at viktige ting bør bekreftes med rett instans.`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Ikke innlogget", { status: 401 });

  let body: { brevId?: string; melding?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Ugyldig forespørsel", { status: 400 });
  }

  const brevId = String(body.brevId ?? "");
  const melding = String(body.melding ?? "").trim();
  if (!brevId || !melding) return new Response("Mangler data", { status: 400 });
  if (melding.length > 4000)
    return new Response("Meldingen er for lang", { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY)
    return new Response("AI er ikke konfigurert", { status: 503 });

  // Brevet + forklaringen (RLS sikrer eierskap).
  const { data: brev } = await supabase
    .from("brev")
    .select("original_tekst, forklaring, sak_id")
    .eq("id", brevId)
    .maybeSingle();
  if (!brev) return new Response("Fant ikke brevet", { status: 404 });

  // Sakskontekst: kreditor, stadium, beløp + tidligere brev på samme krav.
  const [{ data: sak }, { data: sakBrev }, { data: tidligere }] =
    await Promise.all([
      supabase
        .from("saker")
        .select("kreditor, stadium, belop_totalt")
        .eq("id", brev.sak_id)
        .maybeSingle(),
      supabase
        .from("brev")
        .select("brevtype, brevdato")
        .eq("sak_id", brev.sak_id)
        .order("brevdato", { ascending: true, nullsFirst: true }),
      supabase
        .from("brev_samtale")
        .select("rolle, innhold")
        .eq("brev_id", brevId)
        .order("opprettet", { ascending: true }),
    ]);

  const kontekstlinjer = [
    sak?.kreditor ? `Kreditor/avsender: ${sak.kreditor}` : null,
    sak?.stadium
      ? `Stadium: ${STADIUM_ETIKETT[sak.stadium as Stadium]}`
      : null,
    sak?.belop_totalt != null ? `Totalt beløp: ${sak.belop_totalt} kr` : null,
    (sakBrev ?? []).length > 0
      ? `Brev på saken: ${(sakBrev ?? [])
          .map(
            (b) =>
              `${b.brevtype ?? "brev"}${
                b.brevdato ? ` (${formaterKortDato(b.brevdato)})` : ""
              }`,
          )
          .join(", ")}`
      : null,
  ].filter(Boolean);

  const system =
    kontekstlinjer.length > 0
      ? `${SYSTEM_BASE}\n\nKort om saken (bruk kun som bakgrunn, ikke gjenta ukritisk):\n${kontekstlinjer.join("\n")}`
      : SYSTEM_BASE;

  // Lagre brukermeldingen før vi svarer.
  await supabase.from("brev_samtale").insert({
    brev_id: brevId,
    bruker_id: user.id,
    rolle: "bruker",
    innhold: melding,
  });

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `Her er teksten fra brevet:\n\n${brev.original_tekst}` },
    { role: "assistant", content: brev.forklaring },
    ...(tidligere ?? []).map((m) => ({
      role: (m.rolle === "bruker" ? "user" : "assistant") as "user" | "assistant",
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
          system,
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
            brev_id: brevId,
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
