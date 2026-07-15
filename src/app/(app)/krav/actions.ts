"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SAK_UTFALL, type SakUtfall } from "@/lib/types";
import { STADIER } from "@/lib/gjeld";

/** Oppretter et krav manuelt (uten brev). Brukeren kan legge til brev senere. */
export async function opprettKrav(input: {
  kreditor: string;
  belop: string;
  saksnummer: string;
  stadium: string;
}): Promise<{ ok: true; sakId: string } | { ok: false; feil: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  const kreditor = input.kreditor.trim();
  const saksnummer = input.saksnummer.trim();
  const belopTall = input.belop.trim()
    ? Number(input.belop.replace(/\s/g, ""))
    : null;
  const stadium = (STADIER as readonly string[]).includes(input.stadium)
    ? input.stadium
    : null;

  const { data: sak, error } = await supabase
    .from("saker")
    .insert({
      bruker_id: user.id,
      tittel: kreditor || "Nytt krav",
      kreditor: kreditor || null,
      saksnummer: saksnummer || null,
      belop_totalt: belopTall != null && !Number.isNaN(belopTall) ? belopTall : null,
      stadium,
      status: "aktiv",
      kategori: "okonomi",
    })
    .select("id")
    .single();
  if (error || !sak)
    return { ok: false, feil: "Kunne ikke opprette kravet. Prøv igjen." };

  revalidatePath("/");
  revalidatePath("/krav");
  return { ok: true, sakId: sak.id };
}

/** Markerer et krav som løst (status='fullfort') og lagrer valgfritt utfall.
 *  Utløser løst-sak-seremonien. RLS sørger for at man kun endrer sitt eget. */
export async function markerLost(
  id: string,
  utfall?: SakUtfall | null,
): Promise<void> {
  if (!id) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  const oppdatering: Record<string, unknown> = { status: "fullfort" };
  if (utfall && (SAK_UTFALL as readonly string[]).includes(utfall)) {
    oppdatering.utfall = utfall;
  }
  await supabase.from("saker").update(oppdatering).eq("id", id);

  revalidatePath("/");
  revalidatePath("/krav");
  revalidatePath(`/krav/${id}`);
}

/** Sletter et krav (sak). RLS sørger for at man kun sletter sitt eget. */
export async function slettKrav(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  await supabase.from("saker").delete().eq("id", id);

  revalidatePath("/krav");
  redirect("/krav");
}
