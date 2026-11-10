import Anthropic from "@anthropic-ai/sdk";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { STADIUM_ETIKETT, type Stadium } from "@/lib/gjeld";
import { formaterKortDato } from "@/lib/dato";
import { AI_MODELL } from "@/lib/ai";
import { klassifiserAiFeil, vurderStopp, type AiFeil } from "@/lib/ai-svar";
import { logg } from "@/lib/logg";
import { maskerFodselsnummer } from "@/lib/maskering";
import { DOKUMENT_REGEL } from "@/lib/dokumentdata";
import { forsokId, skalBelastes } from "@/lib/kvote";
import { startKvote } from "@/lib/kvote-server";
import { SAMTALE_MAKS_TOKENS, byggSamtale } from "@/lib/samtale-prompt";

// AI-svar kan ta tid å strømme — gi funksjonen rom på Vercel.
export const maxDuration = 60;

const SYSTEM_BASE = `Du hjelper en person som har fått et brev om gjeld/inkasso og stiller oppfølgingsspørsmål. De har allerede fått en forklaring av brevet.

Regler:
- Svar på enkelt, varmt norsk (bokmål) — MED MINDRE brukeren ber om et annet språk; da svarer du på det.
- Du forklarer og hjelper, men gir ALDRI juridiske eller økonomiske vedtak, konklusjoner eller garantier.
- Finn ALDRI opp fakta, frister, beløp eller paragrafer som ikke står i brevet, saken eller samtalen. Er noe uklart, si det heller.
- Hold deg til saken og det brukeren spør om.
- Når du gir konkrete råd, minn kort om at dette ikke er profesjonell rådgivning, og at viktige ting bør bekreftes med rett instans.

${DOKUMENT_REGEL}`;

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
  // Fødselsnummer i spørsmålet går hverken til AI-en eller inn i samtalen.
  const melding = maskerFodselsnummer(String(body.melding ?? "").trim());
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

  // Kvoten håndheves på serveren. Det samme spørsmålet på nytt belastes ikke
  // to ganger. Brevet og samtalen kan fortsatt leses når kvoten er brukt opp.
  const kvote = await startKvote("chat", user.id, forsokId("chat", user.id, brevId, melding));
  if (!kvote.ok)
    return new Response(kvote.melding, {
      status: kvote.status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });

  // Lagre brukermeldingen før vi svarer.
  await supabase.from("brev_samtale").insert({
    brev_id: brevId,
    bruker_id: user.id,
    rolle: "bruker",
    innhold: melding,
  });

  // Begrenset historikk og lengde, så kostnaden per spørsmål har et tak.
  const messages: Anthropic.MessageParam[] = byggSamtale({
    originalTekst: brev.original_tekst,
    forklaring: brev.forklaring,
    tidligere: tidligere ?? [],
    melding,
  });

  const anthropic = new Anthropic();
  const encoder = new TextEncoder();
  let fullt = "";
  // Bare et komplett svar lagres i samtalen.
  let komplett = false;
  let aiFeil: AiFeil | null = null;
  let inn: number | undefined;
  let ut: number | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = anthropic.messages.stream({
          model: AI_MODELL,
          max_tokens: SAMTALE_MAKS_TOKENS,
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
        const slutt = await claudeStream.finalMessage();
        inn = slutt.usage?.input_tokens;
        ut = slutt.usage?.output_tokens;
        aiFeil = vurderStopp(slutt.stop_reason);
        if (aiFeil) {
          controller.enqueue(
            encoder.encode(
              "\n\n[Svaret ble avbrutt fordi det ble for langt. Det er ikke lagret. Prøv et kortere spørsmål.]",
            ),
          );
        } else {
          komplett = true;
        }
      } catch (feil) {
        aiFeil = klassifiserAiFeil(feil);
        logg("error", "brev-samtale", "strom_feilet", { feil: aiFeil });
        controller.enqueue(
          encoder.encode("\n\n[Beklager, noe gikk galt. Svaret er ikke lagret. Prøv igjen.]"),
        );
      } finally {
        await kvote.vakt.avslutt(skalBelastes(aiFeil), {
          modell: AI_MODELL,
          inn_tokens: inn,
          ut_tokens: ut,
          ai_kall: 1,
          feil: aiFeil ?? undefined,
        });
        if (komplett && fullt.trim()) {
          await supabase.from("brev_samtale").insert({
            brev_id: brevId,
            bruker_id: user.id,
            rolle: "assistent",
            innhold: maskerFodselsnummer(fullt),
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
