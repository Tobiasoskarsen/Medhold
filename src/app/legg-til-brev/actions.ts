"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { FristForslag } from "@/lib/types";
import { beregnFrist, foreslaStadium, BREVTYPER, type BrevType } from "@/lib/gjeld";

// Strukturert utdata. «AI tolker, kode beslutter»: modellen trekker KUN ut det
// som eksplisitt står i brevet. Beregnede frister lages i kode, ikke her.
const SVAR_SKJEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    forklaring: {
      type: "string",
      description:
        "Forklaring på enkelt, varmt norsk av hva brevet betyr. Avsluttes med en kort påminnelse om at dette ikke er profesjonell rådgivning.",
    },
    brevtype: {
      type: "string",
      enum: [...BREVTYPER],
      description:
        "Hvilken type brev dette er. Bruk 'annet' hvis det ikke passer inn i gjeld-/inkassotrinnene.",
    },
    avsender: {
      type: "string",
      description: "Hvem brevet er fra (inkassoselskap/kreditor). Tom hvis uklart.",
    },
    brevdato: {
      type: "string",
      description:
        "Dato brevet er datert, ÅÅÅÅ-MM-DD. KUN hvis den står i brevet. Ellers tom streng.",
    },
    belop: {
      type: "string",
      description:
        "Totalt utestående beløp i kroner, kun sifre. KUN hvis det står eksplisitt. Ellers tom streng.",
    },
    saksnummer: {
      type: "string",
      description: "Saks-/referansenummer. KUN hvis det står i brevet. Ellers tom streng.",
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
  required: [
    "forklaring",
    "brevtype",
    "avsender",
    "brevdato",
    "belop",
    "saksnummer",
    "foreslatte_steg",
    "foreslatte_frister",
  ],
} as const;

function systemprompt(idag: string): string {
  return `Du hjelper en person som har fått et brev om gjeld/inkasso og ofte er overveldet.

Oppgaven din: forklar hva brevet betyr, foreslå konkrete neste steg, og trekk ut nøkkelfakta.

Ufravikelige regler:
- Svar på enkelt, varmt og rolig norsk (bokmål). Unngå byråkratspråk.
- Du FORKLARER og FORESLÅR. Du gir ALDRI juridiske eller økonomiske vedtak, konklusjoner eller garantier.
- Finn ALDRI opp frister, beløp, datoer, saksnummer, paragrafer eller fakta som ikke står i teksten. Er noe uklart, la feltet stå tomt.
- Oppgi brevdato, beløp og saksnummer KUN når de står eksplisitt i brevet. Ellers tom streng.
- Foreslå kun frister som er eksplisitt nevnt i brevet, med dato kun når en konkret dato er oppgitt.
- I dag er ${idag}. Bruk dette bare til å forstå teksten – ikke til å regne ut frister som ikke står der.
- Avslutt alltid "forklaring" med én kort setning: at dette er hjelp til å få oversikt, ikke profesjonell rådgivning, og at viktige ting bør bekreftes med rett instans.`;
}

type Analyse = {
  forklaring: string;
  brevtype: BrevType;
  avsender: string;
  brevdato: string;
  belop: string;
  saksnummer: string;
  foreslatte_steg: string[];
  foreslatte_frister: { tittel: string; forfallsdato: string }[];
};

export type AnalyseResultat =
  | {
      ok: true;
      analyse: Analyse;
      /** Teksten som lagres som original_tekst (innlimt eller ekstrahert). */
      original_tekst: string;
      /** Frist beregnet deterministisk av kode (kilde='beregnet'), om noen. */
      beregnetFrist: { tittel: string; forfallsdato: string } | null;
      /** Eksisterende krav som brevet trolig hører til (saksnummer/kreditor). */
      matchetKravId: string | null;
    }
  | { ok: false; feil: string };

// Kode beslutter: beregn frist av regel + match mot eksisterende krav. Deles
// mellom tekst- og bildeanalysen.
async function etterbehandle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  analyse: Analyse,
): Promise<{
  beregnetFrist: { tittel: string; forfallsdato: string } | null;
  matchetKravId: string | null;
}> {
  const beregnet =
    analyse.brevdato && analyse.brevtype
      ? beregnFrist(analyse.brevtype, analyse.brevdato)
      : null;
  const beregnetFrist = beregnet
    ? { tittel: beregnet.tittel, forfallsdato: beregnet.forfallsdato }
    : null;

  const { data: saker } = await supabase
    .from("saker")
    .select("id, kreditor, saksnummer");
  const norm = (s: string | null) => (s ?? "").trim().toLowerCase();
  const liste = saker ?? [];
  let matchetKravId: string | null = null;
  if (analyse.saksnummer) {
    matchetKravId =
      liste.find((s) => norm(s.saksnummer) === norm(analyse.saksnummer))?.id ??
      null;
  }
  if (!matchetKravId && analyse.avsender) {
    matchetKravId =
      liste.find((s) => norm(s.kreditor) === norm(analyse.avsender))?.id ?? null;
  }
  return { beregnetFrist, matchetKravId };
}

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

  let analyse: Analyse;
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
    analyse = JSON.parse(blokk.text) as Analyse;
  } catch {
    return { ok: false, feil: "Noe gikk galt under analysen. Prøv igjen om litt." };
  }

  const { beregnetFrist, matchetKravId } = await etterbehandle(supabase, analyse);
  return { ok: true, analyse, original_tekst: rensket, beregnetFrist, matchetKravId };
}

export type Bilde = { media_type: string; data: string };

// Vision-skjema: samme som tekst, men modellen transkriberer også brevet slik
// at vi kan lagre teksten (ikke bildet). Maks 2 bilder per brev.
const VISJON_SKJEMA = {
  ...SVAR_SKJEMA,
  properties: {
    ...SVAR_SKJEMA.properties,
    ekstrahert_tekst: {
      type: "string",
      description: "Ordrett transkripsjon av all tekst i brevet.",
    },
  },
  required: [...SVAR_SKJEMA.required, "ekstrahert_tekst"],
} as const;

export async function analyserBrevBilder(
  bilder: Bilde[],
): Promise<AnalyseResultat> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  if (bilder.length === 0)
    return { ok: false, feil: "Legg til minst ett bilde av brevet." };
  if (bilder.length > 2)
    return { ok: false, feil: "Maks to bilder per brev." };
  if (!process.env.ANTHROPIC_API_KEY)
    return { ok: false, feil: "AI er ikke konfigurert (mangler API-nøkkel)." };

  const idag = new Date().toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const innhold: Anthropic.ContentBlockParam[] = bilder.map((b) =>
    b.media_type === "application/pdf"
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: b.data },
        }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: b.media_type as
              | "image/jpeg"
              | "image/png"
              | "image/webp"
              | "image/gif",
            data: b.data,
          },
        },
  );
  innhold.push({
    type: "text",
    text: "Her er brevet som bilde(r). Transkriber teksten og analyser det etter reglene.",
  });

  let analyse: Analyse & { ekstrahert_tekst: string };
  try {
    const anthropic = new Anthropic();
    const svar = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      thinking: { type: "disabled" },
      system: systemprompt(idag),
      output_config: { format: { type: "json_schema", schema: VISJON_SKJEMA } },
      messages: [{ role: "user", content: innhold }],
    });
    const blokk = svar.content.find((b) => b.type === "text");
    if (!blokk || blokk.type !== "text")
      return { ok: false, feil: "Fikk ikke et brukbart svar. Prøv igjen." };
    analyse = JSON.parse(blokk.text) as Analyse & { ekstrahert_tekst: string };
  } catch {
    return { ok: false, feil: "Kunne ikke lese bildet. Prøv et tydeligere bilde." };
  }

  const { ekstrahert_tekst, ...rest } = analyse;
  const { beregnetFrist, matchetKravId } = await etterbehandle(supabase, rest);
  return {
    ok: true,
    analyse: rest,
    original_tekst: ekstrahert_tekst,
    beregnetFrist,
    matchetKravId,
  };
}

export type LagreBrevInput = {
  krav:
    | { modus: "ny"; kreditor: string }
    | { modus: "eksisterende"; sakId: string };
  avsender: string;
  brevtype: BrevType | null;
  brevdato: string; // "" hvis ukjent
  belop: number | null;
  saksnummer: string;
  original_tekst: string;
  forklaring: string;
  foreslatte_steg: string[]; // valgte steg
  valgteFrister: FristForslag[]; // valgte frister med kilde
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

  const stadium = foreslaStadium(input.brevtype ?? "annet");

  // 1) Finn eller opprett kravet (saken), og hold nøkkelfeltene oppdatert.
  let sakId: string;
  if (input.krav.modus === "eksisterende") {
    sakId = input.krav.sakId;
    const oppdatering: Record<string, unknown> = {};
    if (stadium) oppdatering.stadium = stadium;
    if (input.belop != null) oppdatering.belop_totalt = input.belop;
    if (input.saksnummer.trim()) oppdatering.saksnummer = input.saksnummer.trim();
    if (Object.keys(oppdatering).length > 0) {
      await supabase.from("saker").update(oppdatering).eq("id", sakId);
    }
  } else {
    const navn = input.krav.kreditor.trim() || input.avsender.trim() || "Nytt krav";
    const { data: sak, error } = await supabase
      .from("saker")
      .insert({
        bruker_id: user.id,
        tittel: navn,
        kreditor: input.krav.kreditor.trim() || input.avsender.trim() || null,
        saksnummer: input.saksnummer.trim() || null,
        belop_totalt: input.belop,
        stadium,
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

  // 3) Frister (med riktig kilde) og steg.
  const frister = input.valgteFrister.filter((f) => f.forfallsdato);
  if (frister.length > 0) {
    await supabase.from("frister").insert(
      frister.map((f) => ({
        sak_id: sakId,
        bruker_id: user.id,
        tittel: f.tittel,
        forfallsdato: f.forfallsdato,
        brev_id: brev.id,
        kilde: f.kilde,
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
