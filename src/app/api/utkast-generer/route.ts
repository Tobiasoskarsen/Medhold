import Anthropic from "@anthropic-ai/sdk";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { harPluss } from "@/lib/plan";
import { AI_MODELL, UTKAST_STRØM_MARKØR as MARKØR } from "@/lib/ai";
import { UTKAST_TYPER, type UtkastType } from "@/lib/types";
import {
  etterkontroll,
  fjernStjerner,
  rettemelding,
  type Omfang,
  type UtkastMelding,
} from "@/lib/utkast-prompt";
import { kontrollerUtkast, type VaktFunn } from "@/lib/utkast-vakt";
import { klassifiserAiFeil, vurderStopp, type AiFeil } from "@/lib/ai-svar";
import { logg } from "@/lib/logg";
import { normaliserBelopITekst } from "@/lib/format";
import { forsokId, skalBelastes } from "@/lib/kvote";
import { startKvote } from "@/lib/kvote-server";
import { maskerFodselsnummer } from "@/lib/maskering";
import { byggUtkastPrompt } from "../../(app)/krav/[id]/utkast/byggUtkastPrompt";

// AI-svar kan ta tid å strømme — gi funksjonen rom på Vercel (samme mønster
// som api/brev-samtale/route.ts).
export const maxDuration = 60;

// Ingen eksisterende grense på `detaljer` ble funnet i dagens `lagUtkast`
// (arbeidsordren antok én — se PROSJEKT_STATUS «Valg tatt underveis»). Denne
// er en ny, romslig fornuftsgrense for et fritekstfelt ment å være kort.
const DETALJER_MAKS_TEGN = 2000;

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
    omfang?: unknown;
  };
  try {
    body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Ugyldig forespørsel");
  } catch {
    return new Response("Ugyldig forespørsel", { status: 400 });
  }

  const kravId = String(body.kravId ?? "");
  const brevId = body.brevId ? String(body.brevId) : null;
  const type = String(body.type ?? "");
  // Fødselsnummer brukeren skriver inn, går hverken til AI-en eller inn i utkastet.
  const detaljer = maskerFodselsnummer(String(body.detaljer ?? ""));
  const navn = String(body.navn ?? "");
  const avdrag = body.avdrag ?? null;
  const omfang: Omfang | null =
    body.omfang === "delvis" || body.omfang === "helt" ? body.omfang : null;

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
    omfang,
  );
  if ("feil" in prompt) return new Response(prompt.feil, { status: prompt.status ?? 404 });
  const { system, meldinger, vaktFakta } = prompt;

  // Kvoten håndheves på serveren. Den samme bestillingen på nytt belastes ikke
  // to ganger. Lagrede utkast kan fortsatt åpnes når kvoten er brukt opp.
  const kvote = await startKvote(
    "utkast",
    user.id,
    forsokId("utkast", user.id, kravId, brevId, type, detaljer, navn, JSON.stringify(avdrag), omfang),
  );
  if (!kvote.ok)
    return new Response(kvote.melding, {
      status: kvote.status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  let aiKall = 0;
  let innTokens = 0;
  let utTokens = 0;
  // Første feil som stoppet utkastet; null når det ble ferdig.
  let utfallFeil: AiFeil | "lagring" | null = null;

  // Samlet modellbudsjett for første forsøk og eventuell regenerering.
  // La Vercels 60-sekundersgrense ha rom til feilmarkør og kvoteavslutning.
  const modellSignal = AbortSignal.timeout(45_000);
  const anthropic = new Anthropic({ maxRetries: 0 });
  const encoder = new TextEncoder();
  const navnTrimmet = navn.trim();

  const stream = new ReadableStream({
    async start(controller) {
      function send(tekst: string) {
        controller.enqueue(encoder.encode(tekst));
      }

      // Strømmer én generasjon (system+meldinger) til klienten og returnerer
      // den fullstendige, stjerne-rensede teksten, eller hvorfor den ikke ble
      // ferdig. Et avkuttet utkast (max_tokens, avslag) er aldri ferdig.
      async function strømOgSamle(
        meld: UtkastMelding[],
      ): Promise<{ tekst: string } | { feil: AiFeil }> {
        let fullt = "";
        aiKall++;
        try {
          const claudeStream = anthropic.messages.stream({
            model: AI_MODELL,
            max_tokens: 1500,
            thinking: { type: "disabled" },
            system,
            messages: meld,
          }, { signal: modellSignal });
          for await (const event of claudeStream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              fullt += event.delta.text;
              send(event.delta.text);
            }
          }
          const slutt = await claudeStream.finalMessage();
          innTokens += slutt.usage?.input_tokens ?? 0;
          utTokens += slutt.usage?.output_tokens ?? 0;
          const stopp = vurderStopp(slutt.stop_reason);
          if (stopp) return { feil: stopp };
        } catch (feil) {
          const type = modellSignal.aborted ? "tidsavbrudd" : klassifiserAiFeil(feil);
          logg("error", "utkast-generer", "strom_feilet", { feil: type });
          return { feil: type };
        }
        // «3 108,9 kr» rettes før vaktene og lagringen (Del A.3). Brukerens
        // egne redigeringer lagres via en annen vei og røres ikke.
        const tekst = normaliserBelopITekst(fjernStjerner(fullt));
        return tekst ? { tekst } : { feil: "ugyldig_struktur" };
      }

      // Feilkoden følger rett etter markøren, så klienten kan si hva som skjedde.
      function sendFeil(kode: AiFeil | "lagring") {
        utfallFeil = kode;
        send(MARKØR.FEIL + kode);
      }

      try {
        const forste = await strømOgSamle(meldinger);
        if ("feil" in forste) {
          sendFeil(forste.feil);
          return;
        }
        let tekst = forste.tekst;

        // Etterkontroll: «AI tolker, kode beslutter» — også for stil og
        // fakta. Forbudte ord, for langt utkast og vaktfunn (§D.3) → ÉN
        // regenerering med alle rettelsene (ikke en løkke, av
        // kostnadshensyn), samme regel som lagUtkast. Den ukontrollerte
        // teksten vises IKKE som sluttresultat og lagres ALDRI (guardrail 2)
        // — klienten toner den ned og venter på den nye strømmen (§B.3).
        const kontroll = etterkontroll(tekst, vaktFakta);
        let advarsler: VaktFunn[] = kontroll.vaktFunn;
        if (kontroll.problemer.length > 0) {
          const meldinger2: UtkastMelding[] = [
            ...meldinger,
            { role: "assistant", content: tekst },
            { role: "user", content: rettemelding(kontroll.problemer) },
          ];

          send(MARKØR.JUSTERER);
          const andre = await strømOgSamle(meldinger2);
          // Klienten har allerede begynt å vise den nye teksten. Feiler den,
          // lagres ingenting: et halvt nytt utkast skal ikke stå igjen på
          // skjermen mens et annet blir lagret.
          if ("feil" in andre) {
            sendFeil(andre.feil);
            return;
          }
          tekst = andre.tekst;
          // Vakten på nytt: det som står igjen er advarsler, aldri en sperre
          // (guardrail 5). Brukeren ser dem i «Sjekk før du sender».
          advarsler = kontrollerUtkast(tekst, vaktFakta);
          if (advarsler.length > 0) {
            // Bare antall og typer: rettelinjene inneholder beløp og datoer fra saken.
            logg("warn", "utkast-generer", "vaktfunn_etter_regenerering", {
              utkasttype: type,
              antall: advarsler.length,
              typer: [...new Set(advarsler.map((a) => a.type))].sort().join("."),
            });
          }
        }

        // Husk navnet til neste gang (§6). Best-effort.
        if (navnTrimmet) {
          await supabase.auth
            .updateUser({ data: { brevnavn: navnTrimmet } })
            .catch(() => {});
        }

        tekst = maskerFodselsnummer(tekst);
        const { data: lagret, error: lagreFeil } = await supabase
          .from("utkast")
          .insert({
            sak_id: kravId,
            bruker_id: user.id,
            brev_id: brevId,
            type,
            innhold: maskerFodselsnummer(tekst),
            vakt_fakta: vaktFakta,
          })
          .select("id, versjon")
          .single();
        if (lagreFeil || !lagret) {
          logg("error", "utkast-generer", "innsetting_feilet", {
            utkasttype: type,
            kode: lagreFeil?.code ?? "ukjent",
          });
          sendFeil("lagring");
          return;
        }

        // Sluttmarkøren bærer id, advarsler og vaktfaktaene klienten bruker
        // til å kontrollere utkastet på nytt når brukeren redigerer (§D.4).
        const slutt = {
          id: lagret.id,
          tekst,
          versjon: lagret.versjon,
          advarsler,
          fakta: vaktFakta,
        };
        send(MARKØR.FERDIG + JSON.stringify(slutt));
      } finally {
        // Operasjonelle feil og en feilet lagring belaster ikke brukeren.
        const feil = utfallFeil as AiFeil | "lagring" | null;
        await kvote.vakt.avslutt(feil === "lagring" ? false : skalBelastes(feil), {
          modell: AI_MODELL,
          inn_tokens: innTokens,
          ut_tokens: utTokens,
          ai_kall: aiKall,
          feil: feil ?? undefined,
        });
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
