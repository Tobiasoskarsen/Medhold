// Serverhjelper rundt lib/kvote.ts: henter service_role-klienten, gjør svaret om
// til en melding og HTTP-status, og sørger for at en reservasjon bare
// avsluttes én gang. Kostnadsmålingene logges som tall, aldri tekst.
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fullforKvote,
  kvoteMelding,
  reserverKvote,
  type KvoteHandling,
  type KvoteSvar,
  type Maling,
  type RpcKlient,
} from "@/lib/kvote";
import { logg } from "@/lib/logg";

export type Kvotevakt = {
  /** Gjenstående i vinduet etter denne, når databasen oppga det. */
  igjen: number | null;
  /** Første kall gjelder; senere kall gjør ingenting. */
  avslutt(brukt: boolean, maling?: Maling): Promise<void>;
};

export type Kvotestart =
  | { ok: true; vakt: Kvotevakt }
  | { ok: false; melding: string; status: 409 | 429 | 503 };

function adminKlient(): RpcKlient | null {
  try {
    return createAdminClient() as unknown as RpcKlient;
  } catch {
    return null;
  }
}

function avvisning(svar: Extract<KvoteSvar, { ok: false }>, handling: string): Kvotestart {
  logg("warn", "kvote", "avvist", { handling, grunn: svar.grunn });
  return {
    ok: false,
    melding: kvoteMelding(svar),
    status: svar.grunn === "kvote" ? 429 : svar.grunn === "pagar" ? 409 : 503,
  };
}

/**
 * Reserverer kvote for en AI-handling. Kan ikke kvoten sjekkes (databasen er
 * nede, migrasjonen mangler), stoppes handlingen: AI-kall skal ikke gå
 * ubegrenset. Ingenting av brukerens kvote er brukt i så fall.
 */
export async function startKvote(
  handling: KvoteHandling,
  brukerId: string,
  forsok: string | null,
): Promise<Kvotestart> {
  const db = adminKlient();
  if (!db) return avvisning({ ok: false, grunn: "feil", handling: null, grense: null, nullstilles: null }, handling);
  const svar = await reserverKvote(db, handling, brukerId, forsok);
  if (!svar.ok) return avvisning(svar, handling);

  const start = Date.now();
  let ferdig = false;
  return {
    ok: true,
    vakt: {
      igjen: svar.igjen,
      async avslutt(brukt, maling = {}) {
        if (ferdig) return;
        ferdig = true;
        const m: Maling = { varighet_ms: Date.now() - start, ...maling };
        // Et gjentatt forsøk er allerede belastet; databasen endrer det ikke.
        await fullforKvote(db, svar.gruppe, brukt, m);
        logg("info", "kvote", brukt ? "brukt" : "frigitt", {
          handling,
          gjentatt: svar.gjentatt,
          modell: m.modell,
          inn: m.inn_tokens,
          ut: m.ut_tokens,
          kall: m.ai_kall,
          ms: m.varighet_ms,
          feil: m.feil,
        });
      },
    },
  };
}
