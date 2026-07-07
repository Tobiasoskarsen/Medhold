"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
