"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SakUtfall } from "@/lib/types";
import { STADIER } from "@/lib/gjeld";
import { validerKravbelop } from "@/lib/format";
import { gjenapneSak, settFristStatus, settSakUtfall } from "@/lib/saksstatus";

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
  const belop = validerKravbelop(input.belop);
  if (belop.status === "ugyldig") return { ok: false, feil: belop.feil };
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
      belop_totalt: belop.status === "gyldig" ? belop.kroner : null,
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

/**
 * Registrerer utfallet på et krav etter den ene regelen i lib/utfall.ts. Et
 * valg som avslutter saken krever bekreftelse. Eierskap sjekkes i settSakUtfall.
 */
export async function settUtfall(
  id: string,
  utfall: SakUtfall | null,
  bekreftetAvslutning: boolean,
  /** Sakens sist_endret da brukeren så den. Endret siden? Da avvises endringen. */
  forventetSistEndret: string,
): Promise<{ ok: true } | { ok: false; feil: string }> {
  if (!id) return { ok: false, feil: "Fant ikke saken." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  const r = await settSakUtfall(
    supabase,
    user.id,
    id,
    utfall,
    bekreftetAvslutning,
    forventetSistEndret,
  );
  if (!r.ok) return r;

  revalidatePath("/");
  revalidatePath("/krav");
  revalidatePath(`/krav/${id}`);
  return { ok: true };
}

/** Åpner en avsluttet sak igjen. Utfallet beholdes som historikk. */
export async function gjenapneKrav(
  id: string,
  forventetSistEndret: string,
): Promise<{ ok: true } | { ok: false; feil: string }> {
  if (!id) return { ok: false, feil: "Fant ikke saken." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  const r = await gjenapneSak(supabase, user.id, id, forventetSistEndret);
  if (!r.ok) return r;

  revalidatePath("/");
  revalidatePath("/krav");
  revalidatePath(`/krav/${id}`);
  return { ok: true };
}

/** Marker en frist som fullført, eller angre. Sletter aldri fristen. */
export async function endreFrist(
  fristId: string,
  ny: "aktiv" | "fullfort",
): Promise<{ ok: true } | { ok: false; feil: string }> {
  if (!fristId || (ny !== "aktiv" && ny !== "fullfort"))
    return { ok: false, feil: "Fant ikke fristen." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  const r = await settFristStatus(supabase, user.id, fristId, ny);
  if (!r.ok) return { ok: false, feil: r.feil };

  revalidatePath("/");
  revalidatePath("/krav");
  revalidatePath(`/krav/${r.sakId}`);
  return { ok: true };
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
