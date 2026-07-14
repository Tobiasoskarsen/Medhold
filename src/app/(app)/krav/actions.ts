"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SAK_UTFALL, type SakUtfall } from "@/lib/types";

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
