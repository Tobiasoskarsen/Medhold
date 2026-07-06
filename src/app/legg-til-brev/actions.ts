"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { BrevAnalyse, ForeslattFrist } from "@/lib/types";
import { foreslaStadium, type BrevType } from "@/lib/gjeld";

// Modellen tvinges til dette formatet. I Fase 2 trekker vi ut forklaring, steg
// og eksplisitte frister; brevtype/avsender/beløp fyller brukeren selv i steg 3
// (auto-uttrekk kommer i Fase 3, seksjon 5.1).
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
      description: "Frister som STÅR EKSPLISITT i brevet. Aldri funnet opp.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          tittel: { type: "string" },
          forfallsdato: {
            type: "string",
            description:
              "Konkret dato ÅÅÅÅ-MM-DD hvis brevet oppgir en eksakt dato. Ellers tom streng.",
          },
        },
        required: ["tittel", "forfallsdato"],
      },
    },
  },
  required: ["forklaring", "foreslatte_steg", "foreslatte_frister"],
} as const;

function systemprompt(idag: string): string {
  return `Du hjelper en person som har fått et brev om gjeld/inkasso og ofte er overveldet.

Oppgaven din: forklar hva brevet betyr, og foreslå konkrete neste steg og eventuelle frister.

Ufravikelige regler:
- Svar på enkelt, varmt og rolig norsk (bokmål). Unngå byråkratspråk.
- Du FORKLARER og FORESLÅR. Du gir ALDRI juridiske eller økonomiske vedtak, konklusjoner eller garantier.
- Finn ALDRI opp frister, beløp, paragrafer eller fakta som ikke står i teksten. Er noe uklart, si det heller.
- Foreslå kun frister som er eksplisitt nevnt i brevet. Oppgi forfallsdato kun når brevet gir en konkret dato; ellers la datoen være tom.
- I dag er ${idag}. Bruk dette bare til å forstå teksten – ikke til å regne ut frister som ikke står der.
- Avslutt alltid "forklaring" med én kort setning: at dette er hjelp til å få oversikt, ikke profesjonell rådgivning, og at viktige ting bør bekreftes med rett instans.`;
}

export type AnalyseResultat =
  | { ok: true; analyse: BrevAnalyse }
  | { ok: false; feil: string };

export async function analyserBrevTekst(
  tekst: string,
): Promise<AnalyseResultat> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  const rensket = tekst.trim();
  if (rensket.length < 10)
    return { ok: false, feil: "Lim inn teksten fra brevet først." };
  if (rensket.length > 20000)
    return { ok: false, feil: "Teksten er for lang. Lim inn ett brev av gangen." };
  if (!process.env.ANTHROPIC_API_KEY)
    return { ok: false, feil: "AI er ikke konfigurert (mangler API-nøkkel)." };

  const idag = new Date().toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  try {
    const anthropic = new Anthropic();
    const svar = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      thinking: { type: "disabled" },
      system: systemprompt(idag),
      output_config: { format: { type: "json_schema", schema: SVAR_SKJEMA } },
      // Kun teksten brukeren selv limer inn sendes til Anthropic (GDPR).
      messages: [{ role: "user", content: `Her er teksten fra brevet:\n\n${rensket}` }],
    });
    const blokk = svar.content.find((b) => b.type === "text");
    if (!blokk || blokk.type !== "text")
      return { ok: false, feil: "Fikk ikke et brukbart svar. Prøv igjen." };
    return { ok: true, analyse: JSON.parse(blokk.text) as BrevAnalyse };
  } catch {
    return { ok: false, feil: "Noe gikk galt under analysen. Prøv igjen om litt." };
  }
}

export type LagreBrevInput = {
  krav:
    | { modus: "ny"; kreditor: string }
    | { modus: "eksisterende"; sakId: string };
  avsender: string;
  brevtype: BrevType | null;
  brevdato: string; // "" hvis ukjent
  belop: number | null;
  original_tekst: string;
  forklaring: string;
  foreslatte_steg: string[]; // valgte steg
  valgteFrister: ForeslattFrist[]; // valgte frister med konkret dato
};

export type LagreBrevResultat =
  | { ok: true; sakId: string }
  | { ok: false; feil: string };

export async function lagreBrev(
  input: LagreBrevInput,
): Promise<LagreBrevResultat> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  // 1) Finn eller opprett kravet (saken).
  let sakId: string;
  if (input.krav.modus === "eksisterende") {
    sakId = input.krav.sakId;
  } else {
    const navn = input.krav.kreditor.trim() || input.avsender.trim() || "Nytt krav";
    const { data: sak, error } = await supabase
      .from("saker")
      .insert({
        bruker_id: user.id,
        tittel: navn,
        kreditor: input.krav.kreditor.trim() || input.avsender.trim() || null,
        belop_totalt: input.belop,
        stadium: foreslaStadium(input.brevtype ?? "annet"),
        status: "aktiv",
        kategori: "okonomi",
      })
      .select("id")
      .single();
    if (error || !sak)
      return { ok: false, feil: "Kunne ikke opprette kravet. Prøv igjen." };
    sakId = sak.id;
  }

  // 2) Lagre brevet.
  const { data: brev, error: brevFeil } = await supabase
    .from("brev")
    .insert({
      sak_id: sakId,
      bruker_id: user.id,
      brevdato: input.brevdato || null,
      avsender: input.avsender.trim() || null,
      brevtype: input.brevtype,
      belop: input.belop,
      original_tekst: input.original_tekst,
      forklaring: input.forklaring,
      foreslatte_steg: input.foreslatte_steg,
      foreslatte_frister: input.valgteFrister,
    })
    .select("id")
    .single();
  if (brevFeil || !brev)
    return { ok: false, feil: "Kunne ikke lagre brevet. Prøv igjen." };

  // 3) Frister (eksplisitt oppgitt i brevet) og steg.
  if (input.valgteFrister.length > 0) {
    await supabase.from("frister").insert(
      input.valgteFrister
        .filter((f) => f.forfallsdato)
        .map((f) => ({
          sak_id: sakId,
          bruker_id: user.id,
          tittel: f.tittel,
          forfallsdato: f.forfallsdato,
          brev_id: brev.id,
          kilde: "brev_eksplisitt" as const,
        })),
    );
  }
  if (input.foreslatte_steg.length > 0) {
    await supabase.from("neste_steg").insert(
      input.foreslatte_steg.map((tekst, i) => ({
        sak_id: sakId,
        bruker_id: user.id,
        tekst,
        rekkefolge: i,
      })),
    );
  }

  revalidatePath("/");
  revalidatePath("/krav");
  revalidatePath(`/krav/${sakId}`);
  return { ok: true, sakId };
}
