"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SkjemaResultat = { feil: string } | undefined;

async function krevBruker() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function oppdaterSider(sakId: string) {
  revalidatePath(`/saker/${sakId}`);
  revalidatePath("/saker");
}

// ============ FRISTER ============

export async function leggTilFrist(
  sakId: string,
  _forrige: SkjemaResultat,
  formData: FormData,
): Promise<SkjemaResultat> {
  const { supabase, user } = await krevBruker();

  const tittel = String(formData.get("tittel") ?? "").trim();
  const forfallsdato = String(formData.get("forfallsdato") ?? "").trim();
  const notat = String(formData.get("notat") ?? "").trim();

  if (!tittel) return { feil: "Frist må ha en tittel." };
  if (tittel.length > 200) return { feil: "Tittelen er for lang." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(forfallsdato))
    return { feil: "Velg en gyldig forfallsdato." };
  if (notat.length > 2000) return { feil: "Notatet er for langt." };

  const { error } = await supabase.from("frister").insert({
    sak_id: sakId,
    bruker_id: user.id,
    tittel,
    forfallsdato,
    notat: notat || null,
  });

  if (error) return { feil: "Kunne ikke lagre fristen. Prøv igjen." };

  oppdaterSider(sakId);
}

export async function settFristFullfort(formData: FormData): Promise<void> {
  const { supabase } = await krevBruker();
  const id = String(formData.get("id") ?? "");
  const sakId = String(formData.get("sak_id") ?? "");
  const fullfort = formData.get("fullfort") === "true";
  if (!id) return;

  await supabase.from("frister").update({ fullfort }).eq("id", id);
  oppdaterSider(sakId);
}

export async function slettFrist(formData: FormData): Promise<void> {
  const { supabase } = await krevBruker();
  const id = String(formData.get("id") ?? "");
  const sakId = String(formData.get("sak_id") ?? "");
  if (!id) return;

  await supabase.from("frister").delete().eq("id", id);
  oppdaterSider(sakId);
}

// ============ NESTE STEG ============

export async function leggTilSteg(
  sakId: string,
  _forrige: SkjemaResultat,
  formData: FormData,
): Promise<SkjemaResultat> {
  const { supabase, user } = await krevBruker();

  const tekst = String(formData.get("tekst") ?? "").trim();
  if (!tekst) return { feil: "Steget kan ikke være tomt." };
  if (tekst.length > 500) return { feil: "Steget er for langt." };

  // Nytt steg legges nederst.
  const { data: siste } = await supabase
    .from("neste_steg")
    .select("rekkefolge")
    .eq("sak_id", sakId)
    .order("rekkefolge", { ascending: false })
    .limit(1)
    .maybeSingle();
  const rekkefolge = (siste?.rekkefolge ?? -1) + 1;

  const { error } = await supabase.from("neste_steg").insert({
    sak_id: sakId,
    bruker_id: user.id,
    tekst,
    rekkefolge,
  });

  if (error) return { feil: "Kunne ikke lagre steget. Prøv igjen." };

  oppdaterSider(sakId);
}

// Legg til et AI-foreslått steg med ett klikk (kalles fra klienten).
export async function leggTilForeslattSteg(
  sakId: string,
  tekst: string,
): Promise<{ feil?: string }> {
  const { supabase, user } = await krevBruker();
  const rensket = tekst.trim();
  if (!rensket || rensket.length > 500) return { feil: "Ugyldig steg." };

  const { data: siste } = await supabase
    .from("neste_steg")
    .select("rekkefolge")
    .eq("sak_id", sakId)
    .order("rekkefolge", { ascending: false })
    .limit(1)
    .maybeSingle();
  const rekkefolge = (siste?.rekkefolge ?? -1) + 1;

  const { error } = await supabase.from("neste_steg").insert({
    sak_id: sakId,
    bruker_id: user.id,
    tekst: rensket,
    rekkefolge,
  });
  if (error) return { feil: "Kunne ikke legge til steget." };

  oppdaterSider(sakId);
  return {};
}

// Legg til en AI-foreslått frist med ett klikk (kalles fra klienten).
export async function leggTilForeslattFrist(
  sakId: string,
  tittel: string,
  forfallsdato: string,
): Promise<{ feil?: string }> {
  const { supabase, user } = await krevBruker();
  const rensketTittel = tittel.trim();
  if (!rensketTittel || rensketTittel.length > 200)
    return { feil: "Ugyldig frist." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(forfallsdato))
    return { feil: "Mangler gyldig dato." };

  const { error } = await supabase.from("frister").insert({
    sak_id: sakId,
    bruker_id: user.id,
    tittel: rensketTittel,
    forfallsdato,
  });
  if (error) return { feil: "Kunne ikke legge til fristen." };

  oppdaterSider(sakId);
  return {};
}

export async function settStegFullfort(formData: FormData): Promise<void> {
  const { supabase } = await krevBruker();
  const id = String(formData.get("id") ?? "");
  const sakId = String(formData.get("sak_id") ?? "");
  const fullfort = formData.get("fullfort") === "true";
  if (!id) return;

  await supabase.from("neste_steg").update({ fullfort }).eq("id", id);
  oppdaterSider(sakId);
}

export async function slettSteg(formData: FormData): Promise<void> {
  const { supabase } = await krevBruker();
  const id = String(formData.get("id") ?? "");
  const sakId = String(formData.get("sak_id") ?? "");
  if (!id) return;

  await supabase.from("neste_steg").delete().eq("id", id);
  oppdaterSider(sakId);
}
