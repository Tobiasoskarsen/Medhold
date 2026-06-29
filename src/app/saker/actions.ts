"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { erKategori, erStatus } from "@/lib/types";
import { finnMal } from "@/lib/maler";

export type SakSkjemaResultat = { feil: string } | undefined;

function lesSkjema(formData: FormData) {
  const tittel = String(formData.get("tittel") ?? "").trim();
  const beskrivelse = String(formData.get("beskrivelse") ?? "").trim();
  const status = formData.get("status");
  const kategori = formData.get("kategori");
  return { tittel, beskrivelse, status, kategori };
}

function valider(felt: ReturnType<typeof lesSkjema>): string | null {
  if (!felt.tittel) return "Tittel kan ikke være tom.";
  if (felt.tittel.length > 200) return "Tittel er for lang (maks 200 tegn).";
  if (felt.beskrivelse.length > 5000)
    return "Beskrivelsen er for lang (maks 5000 tegn).";
  if (!erStatus(felt.status)) return "Ugyldig status.";
  if (!erKategori(felt.kategori)) return "Ugyldig kategori.";
  return null;
}

export async function opprettSak(
  _forrige: SakSkjemaResultat,
  formData: FormData,
): Promise<SakSkjemaResultat> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const felt = lesSkjema(formData);
  const feil = valider(felt);
  if (feil) return { feil };

  const { data, error } = await supabase
    .from("saker")
    .insert({
      bruker_id: user.id,
      tittel: felt.tittel,
      beskrivelse: felt.beskrivelse || null,
      status: felt.status,
      kategori: felt.kategori,
    })
    .select("id")
    .single();

  if (error) return { feil: "Kunne ikke lagre saken. Prøv igjen." };

  revalidatePath("/saker");
  redirect(`/saker/${data.id}`);
}

export async function oppdaterSak(
  id: string,
  _forrige: SakSkjemaResultat,
  formData: FormData,
): Promise<SakSkjemaResultat> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const felt = lesSkjema(formData);
  const feil = valider(felt);
  if (feil) return { feil };

  // RLS sørger for at man kun kan oppdatere egne saker.
  const { error } = await supabase
    .from("saker")
    .update({
      tittel: felt.tittel,
      beskrivelse: felt.beskrivelse || null,
      status: felt.status,
      kategori: felt.kategori,
    })
    .eq("id", id);

  if (error) return { feil: "Kunne ikke oppdatere saken. Prøv igjen." };

  revalidatePath("/saker");
  revalidatePath(`/saker/${id}`);
  redirect(`/saker/${id}`);
}

export async function opprettFraMal(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const mal = finnMal(String(formData.get("mal") ?? ""));
  if (!mal) return;

  const { data: sak, error } = await supabase
    .from("saker")
    .insert({
      bruker_id: user.id,
      tittel: mal.tittel,
      beskrivelse: mal.beskrivelse,
      kategori: mal.kategori,
      status: "aktiv",
    })
    .select("id")
    .single();

  if (error || !sak) return;

  // Legg inn de foreslåtte stegene i rekkefølge.
  await supabase.from("neste_steg").insert(
    mal.steg.map((tekst, i) => ({
      sak_id: sak.id,
      bruker_id: user.id,
      tekst,
      rekkefolge: i,
    })),
  );

  revalidatePath("/saker");
  redirect(`/saker/${sak.id}`);
}

export async function slettSak(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS sørger for at man kun kan slette egne saker.
  await supabase.from("saker").delete().eq("id", id);

  revalidatePath("/saker");
  redirect("/saker");
}
