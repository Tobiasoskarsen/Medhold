"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Markerer et krav som løst (status='fullfort'). Utløser løst-sak-seremonien
 *  på kravsiden. RLS sørger for at man kun endrer sitt eget. */
export async function markerLost(id: string): Promise<void> {
  if (!id) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  await supabase.from("saker").update({ status: "fullfort" }).eq("id", id);

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
