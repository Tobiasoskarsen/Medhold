"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { BrevAnalyse } from "@/lib/types";

export type AnalyseResultat =
  | { ok: true; analyse: BrevAnalyse }
  | { ok: false; feil: string };

// Modellen tvinges til å svare i dette formatet (structured outputs).
const SVAR_SKJEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    forklaring: {
      type: "string",
      description:
        "Forklaring på enkelt, varmt norsk av hva brevet betyr. Avsluttes med en kort påminnelse om at dette ikke er profesjonell rådgivning.",
    },
    foreslatte_steg: {
      type: "array",
      description: "Konkrete neste steg utledet KUN fra brevets innhold.",
      items: { type: "string" },
    },
    foreslatte_frister: {
      type: "array",
      description:
        "Frister som STÅR EKSPLISITT i brevet. Aldri funnet opp.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          tittel: { type: "string" },
          forfallsdato: {
            type: "string",
            description:
              "Konkret dato på formatet ÅÅÅÅ-MM-DD hvis brevet oppgir en eksakt dato. Ellers tom streng.",
          },
        },
        required: ["tittel", "forfallsdato"],
      },
    },
  },
  required: ["forklaring", "foreslatte_steg", "foreslatte_frister"],
} as const;

function systemprompt(idag: string): string {
  return `Du hjelper en person som står midt i en vanskelig livssituasjon (sykdom, gjeld, samlivsbrudd, dødsfall) med å forstå et brev de har fått. Personen er ofte overveldet og sårbar.

Oppgaven din: forklar hva brevet betyr, og foreslå konkrete neste steg og eventuelle frister.

Ufravikelige regler:
- Svar på enkelt, varmt og rolig norsk (bokmål). Unngå byråkratspråk og vanskelige ord.
- Du FORKLARER og FORESLÅR. Du gir ALDRI juridiske, medisinske eller økonomiske vedtak, konklusjoner eller garantier.
- Finn ALDRI opp frister, beløp, paragrafer eller fakta som ikke står i teksten. Er noe uklart, si det heller.
- Foreslå kun frister som er eksplisitt nevnt i brevet. Oppgi forfallsdato kun når brevet gir en konkret dato; ellers la datoen være tom.
- I dag er ${idag}. Bruk dette bare til å forstå teksten – ikke til å regne ut frister som ikke står der.
- Avslutt alltid "forklaring" med én kort setning: at dette er hjelp til å få oversikt, ikke profesjonell rådgivning, og at viktige ting bør bekreftes med rett instans (NAV, lege, advokat, kommune e.l.).`;
}

export async function analyserBrev(
  sakId: string,
  _forrige: AnalyseResultat | undefined,
  formData: FormData,
): Promise<AnalyseResultat> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tekst = String(formData.get("tekst") ?? "").trim();
  if (tekst.length < 10) {
    return { ok: false, feil: "Lim inn teksten fra brevet først." };
  }
  if (tekst.length > 20000) {
    return {
      ok: false,
      feil: "Teksten er for lang. Lim inn ett brev av gangen.",
    };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, feil: "AI er ikke konfigurert (mangler API-nøkkel)." };
  }

  const idag = new Date().toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let analyse: BrevAnalyse;
  try {
    const anthropic = new Anthropic();
    const svar = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      thinking: { type: "disabled" },
      system: systemprompt(idag),
      output_config: {
        format: { type: "json_schema", schema: SVAR_SKJEMA },
      },
      // Kun teksten brukeren selv limer inn sendes til Anthropic (GDPR).
      messages: [
        {
          role: "user",
          content: `Her er teksten fra brevet:\n\n${tekst}`,
        },
      ],
    });

    const tekstblokk = svar.content.find((b) => b.type === "text");
    if (!tekstblokk || tekstblokk.type !== "text") {
      return { ok: false, feil: "Fikk ikke et brukbart svar. Prøv igjen." };
    }
    analyse = JSON.parse(tekstblokk.text) as BrevAnalyse;
  } catch {
    return {
      ok: false,
      feil: "Noe gikk galt under analysen. Prøv igjen om litt.",
    };
  }

  // Lagre som dokument-notat på saken.
  await supabase.from("document_note").insert({
    sak_id: sakId,
    bruker_id: user.id,
    original_tekst: tekst,
    forklaring: analyse.forklaring,
    foreslatte_steg: analyse.foreslatte_steg,
    foreslatte_frister: analyse.foreslatte_frister,
  });

  revalidatePath(`/saker/${sakId}`);
  return { ok: true, analyse };
}

// Slett én enkelt brevforklaring (kaskaderer til samtale-tråden).
export async function slettDokumentNotat(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "");
  const sakId = String(formData.get("sak_id") ?? "");
  if (!id) return;

  // RLS sørger for at man kun kan slette egne notater.
  await supabase.from("document_note").delete().eq("id", id);
  revalidatePath(`/saker/${sakId}`);
}
