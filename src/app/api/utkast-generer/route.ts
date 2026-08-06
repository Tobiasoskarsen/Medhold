import Anthropic from "@anthropic-ai/sdk";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { harPluss } from "@/lib/plan";
import { AI_MODELL, UTKAST_STRØM_MARKØR as MARKØR } from "@/lib/ai";
import { tellOrd } from "@/lib/format";
import { finnForbudteOrd } from "@/lib/utkast-stemme";
import { UTKAST_TYPER, type UtkastType } from "@/lib/types";
import type { AvdragsForslag } from "@/lib/avdrag";
import { byggUtkastPrompt, type UtkastMelding } from "../../(app)/krav/[id]/utkast/actions";

// AI-svar kan ta tid å strømme — gi funksjonen rom på Vercel (samme mønster
// som api/brev-samtale/route.ts).
export const maxDuration = 60;

// Ingen eksisterende grense på `detaljer` ble funnet i dagens `lagUtkast`
// (arbeidsordren antok én — se PROSJEKT_STATUS «Valg tatt underveis»). Denne
// er en ny, romslig fornuftsgrense for et fritekstfelt ment å være kort.
const DETALJER_MAKS_TEGN = 2000;

function fjernStjerner(tekst: string): string {
  return tekst
    .replace(/^[ \t]*\*[ \t]+/gm, "")
    .replace(/\*/g, "")
    .trim();
}

function erAvdragsForslag(v: unknown): v is AvdragsForslag {
  if (!v || typeof v !== "object") return false;
  const a = v as Record<string, unknown>;
  return (
    typeof a.manedsbelop === "number" &&
    typeof a.antallMandeder === "number" &&
    typeof a.sisteAvdrag === "number"
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Ikke innlogget", { status: 401 });

  let body: {
    kravId?: string;
    brevId?: string | null;
    type?: string;
    detaljer?: string;
    navn?: string;
    avdrag?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return new Response("Ugyldig forespørsel", { status: 400 });
  }

  const kravId = String(body.kravId ?? "");
  const brevId = body.brevId ? String(body.brevId) : null;
  const type = String(body.type ?? "");
  const detaljer = String(body.detaljer ?? "");
  const navn = String(body.navn ?? "");
  const avdrag = erAvdragsForslag(body.avdrag) ? body.avdrag : null;

  if (!kravId) return new Response("Mangler krav-id", { status: 400 });
  if (!(UTKAST_TYPER as readonly string[]).includes(type))
    return new Response("Ugyldig type", { status: 400 });
  if (detaljer.length > DETALJER_MAKS_TEGN)
    return new Response("Detaljene er for lange", { status: 400 });

  // Gating: utkastgenerering krever Pluss (i pilotmodus alltid tillatt) —
  // 402 så klienten kan skille dette fra andre feil og sende til /pluss.
  if (!(await harPluss(user.id)))
    return new Response("Krever Medhold Pluss", { status: 402 });

  if (!process.env.ANTHROPIC_API_KEY)
    return new Response("AI er ikke konfigurert", { status: 503 });

  const prompt = await byggUtkastPrompt(
    supabase,
    kravId,
    brevId,
    type as UtkastType,
    detaljer,
    navn,
    avdrag,
  );
  if ("feil" in prompt) return new Response(prompt.feil, { status: 404 });
  const { system, meldinger } = prompt;

  const anthropic = new Anthropic();
  const encoder = new TextEncoder();
  const navnTrimmet = navn.trim();

  const stream = new ReadableStream({
    async start(controller) {
      function send(tekst: string) {
        controller.enqueue(encoder.encode(tekst));
      }

      // Strømmer én generasjon (system+meldinger) til klienten og returnerer
      // den fullstendige, stjerne-rensede teksten (samme rensing som
      // dagens genererTekst() gjorde før den returnerte til lagUtkast).
      async function strømOgSamle(
        meld: UtkastMelding[],
      ): Promise<string | null> {
        let fullt = "";
        try {
          const claudeStream = anthropic.messages.stream({
            model: AI_MODELL,
            max_tokens: 1500,
            thinking: { type: "disabled" },
            system,
            messages: meld,
          });
          for await (const event of claudeStream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              fullt += event.delta.text;
              send(event.delta.text);
            }
          }
        } catch (feil) {
          console.error("[utkast-generer] strøm feilet", feil);
          return null;
        }
        return fjernStjerner(fullt);
      }

      try {
        let tekst = await strømOgSamle(meldinger);
        if (tekst === null) {
          send(MARKØR.FEIL);
          return;
        }

        // Etterkontroll: «AI tolker, kode beslutter» — også for stil. Treff på
        // forbudslisten eller for langt utkast → ÉN regenerering (ikke en
        // løkke, av kostnadshensyn), samme regel/rettemelding som dagens
        // lagUtkast. Den ukontrollerte teksten vises IKKE som sluttresultat
        // og lagres ALDRI (guardrail 2) — klienten toner den ned og venter
        // på den nye strømmen (§B.3).
        const treff = finnForbudteOrd(tekst);
        const ordtall = tellOrd(tekst);
        if (treff.length > 0 || ordtall > 300) {
          const problemer: string[] = [];
          if (treff.length > 0)
            problemer.push(
              `Disse ordene/frasene forekommer og MÅ bort: ${treff.join(", ")}.`,
            );
          if (ordtall > 300)
            problemer.push(
              `Brevet er ${ordtall} ord — for langt. Kort det ned til under 200 ord.`,
            );
          const rettemelding = `Utkastet ditt har feil:\n- ${problemer.join("\n- ")}\n\nSkriv HELE brevet på nytt med samme fakta, rettet. Kun brevteksten, ingen forklaring.`;
          const meldinger2: UtkastMelding[] = [
            ...meldinger,
            { role: "assistant", content: tekst },
            { role: "user", content: rettemelding },
          ];

          send(MARKØR.JUSTERER);
          const tekst2 = await strømOgSamle(meldinger2);
          if (tekst2 !== null) {
            const treff2 = finnForbudteOrd(tekst2);
            if (treff2.length > 0) {
              console.error(
                `[utkast-generer] Forbudte ord slapp gjennom etter regenerering (type=${type}): ${treff2.join(", ")}`,
              );
            }
            tekst = tekst2;
          }
          // tekst2 === null: behold første forsøk (tekst) — samme «behold og
          // logg, ikke blokkér brukeren»-prinsipp som dagens lagUtkast bruker
          // når selve regenereringen (ikke etterkontrollen) feiler.
        }

        // Husk navnet til neste gang (§6). Best-effort.
        if (navnTrimmet) {
          await supabase.auth
            .updateUser({ data: { brevnavn: navnTrimmet } })
            .catch(() => {});
        }

        const { data: lagret, error: lagreFeil } = await supabase
          .from("utkast")
          .insert({
            sak_id: kravId,
            bruker_id: user.id,
            brev_id: brevId,
            type,
            innhold: tekst,
          })
          .select("id")
          .single();
        if (lagreFeil || !lagret) {
          console.error(
            `[utkast-generer] Innsetting feilet (type=${type}, brev_id=${brevId}):`,
            lagreFeil,
          );
          send(MARKØR.FEIL);
          return;
        }

        send(MARKØR.FERDIG + lagret.id);
      } finally {
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
