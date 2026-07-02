// E-postutsending for fristpåminnelser. Bruker Resend sitt REST-API direkte
// med fetch (ingen ekstra npm-pakke). Kalles kun server-side fra cron-jobben.

import { fristNærhet, formaterDato } from "@/lib/dato";

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
  return process.env.VARSEL_FRA_EPOST || "Klarvei <onboarding@resend.dev>";
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
    <div style="font-size:18px;font-weight:700;color:#0d9488;margin-bottom:24px;">Klarvei</div>
    <h1 style="font-size:20px;margin:0 0 8px;">Du har frister som nærmer seg</h1>
    <p style="color:#475569;font-size:15px;line-height:1.5;margin:0 0 20px;">
      Her er en rolig påminnelse om det som ligger foran deg. Ta det steg for steg.
    </p>
    <table style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      ${rader}
    </table>
    <div style="margin:24px 0;">
      <a href="${url}/saker" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:10px;">Åpne Klarvei</a>
    </div>
    <p style="color:#94a3b8;font-size:12px;line-height:1.5;margin:24px 0 0;border-top:1px solid #e2e8f0;padding-top:16px;">
      Klarvei er et organiseringsverktøy — ikke profesjonell rådgivning. Sjekk viktige ting med rett instans (NAV, lege, advokat, kommune).<br><br>
      Vil du ikke ha slike påminnelser? Skru dem av under <a href="${url}/konto" style="color:#64748b;">Min konto</a>.
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

Åpne Klarvei: ${url}/saker

Klarvei er et organiseringsverktøy — ikke profesjonell rådgivning.
Skru av påminnelser under Min konto: ${url}/konto`;
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
