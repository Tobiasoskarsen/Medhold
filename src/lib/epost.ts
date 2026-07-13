// E-postutsending for fristpåminnelser. Bruker Resend sitt REST-API direkte
// med fetch (ingen ekstra npm-pakke). Kalles kun server-side fra cron-jobben.

import { fristNærhet, formaterDato } from "@/lib/dato";
import { APP_NAME } from "@/lib/brand";

export type FristVarsel = {
  tittel: string;
  forfallsdato: string; // YYYY-MM-DD
  sakTittel: string | null;
};

const RESEND_ENDEPUNKT = "https://api.resend.com/emails";

// Avsender. I testmodus (uten eget verifisert domene) må dette være
// onboarding@resend.dev, og Resend tillater da bare sending til din egen
// konto-e-post. Sett VARSEL_FRA_EPOST til en adresse på ditt eget domene når
// det er verifisert.
function fraAdresse(): string {
  return process.env.VARSEL_FRA_EPOST || `${APP_NAME} <onboarding@resend.dev>`;
}

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://app2-chi-five.vercel.app"
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Bygger emnelinje ut fra hvor mange og hvor nære fristene er. */
function emne(frister: FristVarsel[]): string {
  if (frister.length === 1) {
    return `Påminnelse: «${frister[0].tittel}» ${fristNærhet(
      frister[0].forfallsdato,
    ).toLowerCase()}`;
  }
  return `Påminnelse: ${frister.length} frister nærmer seg`;
}

function byggHtml(frister: FristVarsel[]): string {
  const url = appUrl();
  const rader = frister
    .map((f) => {
      const sak = f.sakTittel ? escapeHtml(f.sakTittel) : "Uten sak";
      return `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
          <div style="font-weight:600;color:#0f172a;">${escapeHtml(f.tittel)}</div>
          <div style="color:#64748b;font-size:13px;margin-top:2px;">${sak}</div>
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;">
          <div style="font-weight:600;color:#0f172a;">${fristNærhet(f.forfallsdato)}</div>
          <div style="color:#64748b;font-size:13px;margin-top:2px;">${formaterDato(f.forfallsdato)}</div>
        </td>
      </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="nb">
<body style="margin:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="font-size:18px;font-weight:700;color:#0E7C66;margin-bottom:24px;">${APP_NAME}</div>
    <h1 style="font-size:20px;margin:0 0 8px;">Du har frister som nærmer seg</h1>
    <p style="color:#475569;font-size:15px;line-height:1.5;margin:0 0 20px;">
      Her er en rolig påminnelse om det som ligger foran deg. Ta det steg for steg.
    </p>
    <table style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      ${rader}
    </table>
    <div style="margin:24px 0;">
      <a href="${url}/" style="display:inline-block;background:#0E7C66;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:10px;">Åpne ${APP_NAME}</a>
    </div>
    <p style="color:#94a3b8;font-size:12px;line-height:1.5;margin:24px 0 0;border-top:1px solid #e2e8f0;padding-top:16px;">
      ${APP_NAME} er et organiseringsverktøy — ikke profesjonell rådgivning. Sjekk viktige ting med rett instans (NAV, lege, advokat, kommune).<br><br>
      Vil du ikke ha slike påminnelser? Skru dem av under <a href="${url}/meg" style="color:#64748b;">Meg</a>.
    </p>
  </div>
</body>
</html>`;
}

function byggTekst(frister: FristVarsel[]): string {
  const url = appUrl();
  const linjer = frister
    .map(
      (f) =>
        `• ${f.tittel} — ${fristNærhet(f.forfallsdato)} (${formaterDato(
          f.forfallsdato,
        )})${f.sakTittel ? ` [${f.sakTittel}]` : ""}`,
    )
    .join("\n");
  return `Du har frister som nærmer seg:

${linjer}

Åpne ${APP_NAME}: ${url}/

${APP_NAME} er et organiseringsverktøy — ikke profesjonell rådgivning.
Skru av påminnelser under Meg: ${url}/meg`;
}

/**
 * Rolig oppfølging for en sak som har stått en stund i «venter på svar».
 * To tydelige stier: (1) fått svar → legg inn brevet, (2) ikke hørt noe → det er
 * normalt, du trenger ikke gjøre noe. Ingen skremsler, ingen oppdiktede frister.
 */
export async function sendOppfolging(
  til: string,
  kreditor: string | null,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[epost] RESEND_API_KEY mangler — hopper over oppfølging.");
    return false;
  }
  const url = appUrl();
  const emne = kreditor
    ? `Har du hørt fra ${kreditor}?`
    : "Har du hørt noe om kravet ditt?";
  const hvem = kreditor ? escapeHtml(kreditor) : "kreditor";

  const html = `<!doctype html>
<html lang="nb">
<body style="margin:0;background:#f7f7f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c2b33;">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
    <div style="font-size:18px;font-weight:700;color:#0E7C66;margin-bottom:24px;">${APP_NAME}</div>
    <h1 style="font-size:20px;margin:0 0 12px;">Har du hørt fra ${hvem}?</h1>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 12px;">
      Det er en stund siden du sendte svaret ditt. To ting det kan være verdt å vite:
    </p>
    <p style="color:#1c2b33;font-size:15px;line-height:1.6;margin:0 0 8px;font-weight:600;">Har du fått svar?</p>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Legg inn brevet i ${APP_NAME}, så hjelper vi deg å forstå hva det betyr.
    </p>
    <div style="margin:0 0 20px;">
      <a href="${url}/legg-til-brev" style="display:inline-block;background:#0E7C66;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:10px;">Legg til brevet</a>
    </div>
    <p style="color:#1c2b33;font-size:15px;line-height:1.6;margin:0 0 8px;font-weight:600;">Ikke hørt noe?</p>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 20px;">
      Det er vanlig at det tar tid. Du trenger ikke gjøre noe nå — men ta vare på kvitteringen på at du sendte det.
    </p>
    <p style="color:#94a3b8;font-size:12px;line-height:1.5;margin:24px 0 0;border-top:1px solid #e2e8f0;padding-top:16px;">
      ${APP_NAME} er et organiseringsverktøy — ikke profesjonell rådgivning.<br><br>
      Vil du ikke ha slike e-poster? Skru dem av under <a href="${url}/meg" style="color:#64748b;">Meg</a>.
    </p>
  </div>
</body>
</html>`;

  const text = `Har du hørt fra ${kreditor ?? "kreditor"}?

Det er en stund siden du sendte svaret ditt.

Har du fått svar? Legg inn brevet i ${APP_NAME}, så hjelper vi deg å forstå det:
${url}/legg-til-brev

Ikke hørt noe? Det er vanlig at det tar tid. Du trenger ikke gjøre noe nå — men ta vare på kvitteringen på at du sendte det.

${APP_NAME} er et organiseringsverktøy — ikke profesjonell rådgivning.
Skru av slike e-poster under Meg: ${url}/meg`;

  try {
    const res = await fetch(RESEND_ENDEPUNKT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fraAdresse(),
        to: [til],
        subject: emne,
        html,
        text,
      }),
    });
    if (!res.ok) {
      const detalj = await res.text().catch(() => "");
      console.error(`[epost] Resend svarte ${res.status} (oppfølging): ${detalj}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[epost] Uventet feil ved oppfølging:", e);
    return false;
  }
}

/**
 * Sender én samle-e-post med de kommende fristene til én mottaker.
 * Returnerer true ved suksess. Kaster ikke — logger og returnerer false ved feil
 * slik at én mislykket e-post ikke stopper hele cron-kjøringen.
 */
export async function sendFristPaaminnelse(
  til: string,
  frister: FristVarsel[],
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[epost] RESEND_API_KEY mangler — hopper over utsending.");
    return false;
  }
  if (frister.length === 0) return false;

  try {
    const res = await fetch(RESEND_ENDEPUNKT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fraAdresse(),
        to: [til],
        subject: emne(frister),
        html: byggHtml(frister),
        text: byggTekst(frister),
      }),
    });

    if (!res.ok) {
      const detalj = await res.text().catch(() => "");
      console.error(`[epost] Resend svarte ${res.status}: ${detalj}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[epost] Uventet feil ved utsending:", e);
    return false;
  }
}

/**
 * Sender en engangskode for innlogging. Vi sender den selv via Resend fremfor
 * å stole på Supabase sin innebygde e-post (som er upålitelig/ratelimited).
 * Returnerer true ved suksess.
 *
 * MERK: uten verifisert Resend-domene (avsender onboarding@resend.dev) leverer
 * Resend kun til kontoens egen e-post. Verifiser et domene for å nå andre.
 */
export async function sendKodeEpost(
  til: string,
  kode: string,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[epost] RESEND_API_KEY mangler — kan ikke sende kode.");
    return false;
  }

  const html = `<!doctype html>
<html lang="nb">
<body style="margin:0;background:#f7f7f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c2b33;">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px;">
    <div style="font-size:18px;font-weight:700;color:#0E7C66;margin-bottom:24px;">${APP_NAME}</div>
    <h1 style="font-size:18px;margin:0 0 8px;">Din engangskode</h1>
    <p style="color:#5c6b73;font-size:15px;line-height:1.5;margin:0 0 20px;">Skriv inn denne koden i appen for å logge inn:</p>
    <p style="font-size:32px;font-weight:700;letter-spacing:6px;color:#1c2b33;margin:0 0 20px;">${kode}</p>
    <p style="color:#5c6b73;font-size:13px;line-height:1.5;margin:0;">Koden er gyldig i én time. Har du ikke bedt om den, kan du se bort fra denne e-posten.</p>
  </div>
</body>
</html>`;
  const text = `Din engangskode for ${APP_NAME}: ${kode}

Skriv den inn i appen for å logge inn. Koden er gyldig i én time.
Har du ikke bedt om den, kan du se bort fra denne e-posten.`;

  try {
    const res = await fetch(RESEND_ENDEPUNKT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fraAdresse(),
        to: [til],
        subject: `Din engangskode: ${kode}`,
        html,
        text,
      }),
    });
    if (!res.ok) {
      const detalj = await res.text().catch(() => "");
      console.error(`[epost] Resend svarte ${res.status} (kode): ${detalj}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[epost] Uventet feil ved kode-utsending:", e);
    return false;
  }
}
