# Klarvei

Et verktøy for å holde oversikt over saker, frister og neste steg i en vanskelig
periode — og for å forstå og oversette offentlige brev. Web-app bygget med
Next.js 16 (App Router), TypeScript, Tailwind, Supabase og Anthropic.

> Dette er et organiseringsverktøy — ikke en offentlig tjeneste og ikke
> profesjonell rådgivning.

## Funksjoner

- **Saker** med full CRUD, status og kategori (helse/økonomi/familie/bolig/annet),
  alt beskyttet av row-level security.
- **Frister og neste steg** per sak, med avkryssing. Samlet **«Kommende
  frister»-dashbord** på tvers av alle saker, med nøkkeltall, dato-chips og
  hastegrad.
- **«Hva nå?»-kort** som viser den ene viktigste handlingen akkurat nå.
- **AI-brevhjelp:** lim inn et brev → forklaring på enkelt norsk + foreslåtte
  steg/frister du kan legge til med ett klikk. Kun det du limer inn sendes til
  Anthropic.
- **Samtale per brev** med strømmende svar, og **oversett-knapper** (engelsk,
  arabisk, polsk, somali, ukrainsk, tigrinja) for brukere som trenger brevet på
  eget språk.
- **Maler for krisetyper** (sykdom, gjeld, samlivsbrudd, dødsfall) som oppretter
  en sak med konkrete neste steg. Ingen oppdiktede frister.
- **E-postpåminnelser** før frister (7, 3 og 1 dag før forfall) via daglig
  Vercel Cron og Resend. Kan skrus av/på under **Min konto**.
- **Onboarding** første gang, **personvernerklæring** og **«slett all data +
  konto»** (GDPR).

Deployet på Vercel: <https://app2-chi-five.vercel.app>

## Kom i gang lokalt

### 1. Opprett Supabase-prosjekt (EU-region — viktig for GDPR)

Gå til <https://supabase.com> → **New project**, og velg en **EU-region**
(f.eks. Frankfurt eller Stockholm). Dette er et krav fordi appen behandler
sensitive data.

### 2. Legg inn miljøvariabler i `.env.local` (gitignored, aldri committet)

- `NEXT_PUBLIC_SUPABASE_URL` og `NEXT_PUBLIC_SUPABASE_ANON_KEY` fra Supabase
  **Project Settings → API**.
- `ANTHROPIC_API_KEY` fra <https://console.anthropic.com> (kun server-side —
  aldri `NEXT_PUBLIC_`-prefiks).
- For e-postpåminnelser (valgfritt lokalt): `SUPABASE_SERVICE_ROLE_KEY` (samme
  Supabase-side, hemmelig), `RESEND_API_KEY` fra <https://resend.com>, og
  `CRON_SECRET` (en tilfeldig streng du velger selv). Uten verifisert domene
  sender Resend kun til din egen konto-e-post fra `onboarding@resend.dev`.

### 3. Skru på e-post-innlogging

I Supabase: **Authentication → Providers → Email** skal være på. For rask lokal
testing kan du midlertidig skru **av** «Confirm email» (skru på igjen før
produksjon). Med bekreftelse på: sett **URL Configuration → Site URL** til
`http://localhost:3000` og legg `http://localhost:3000/auth/confirm` i
**Redirect URLs**.

### 4. Kjør databasemigrasjonene

Åpne **SQL Editor** i Supabase og kjør migrasjonene i `supabase/migrations/` i
rekkefølge (`0001` … `0006`). De oppretter tabellene `saker`, `frister`,
`neste_steg`, `document_note`, `brev_samtale` og `sendte_varsler` (alle med
row-level security), og funksjonen `slett_egen_konto()` for GDPR-sletting.

### 5. Kjør

```bash
npm install
npm run dev
```

Åpne <http://localhost:3000>. Du sendes til `/login`. Registrer deg, og du får
en kort intro (`/velkommen`) før «Mine saker».

## Deploy (Vercel)

Miljøvariablene må ligge på Vercel-prosjektet (Production): de to
`NEXT_PUBLIC_SUPABASE_*`, `ANTHROPIC_API_KEY`, og for e-postpåminnelser
`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` og `CRON_SECRET`. Deretter
`vercel --prod`. Cron-jobben registreres automatisk fra `vercel.json`, og Vercel
sender `Authorization: Bearer <CRON_SECRET>` på hvert kall. Husk å sette Supabase
**Site URL / Redirect URLs** til prod-domenet.

> ⚠️ Å sette Vercel-env-vars fra PowerShell ved å pipe verdien til
> `vercel env add` kan legge inn et usynlig BOM-tegn og krasje appen. Skriv
> heller verdien til en BOM-fri fil og bruk `Start-Process node <vc.js> env add
> NAVN production -RedirectStandardInput fil`, eller lim inn i Vercel-dashbordet.

> ⚠️ Strømmende/AI-ruter har `export const maxDuration = 60` — Vercels
> standardgrense (~10s på Hobby) kutter ellers lange AI-svar (oversettelser).

## Arkitektur (kort)

- `src/lib/supabase/{client,server,middleware}.ts` — Supabase-klienter + session.
- `src/proxy.ts` — Next.js proxy (tidl. middleware): fornyer session, beskytter
  ruter.
- `src/app/saker/` — dashbord (`page.tsx`), detalj/rediger/ny, maler (`mal/`),
  server actions (`actions.ts`, `frister-steg-actions.ts`, `ai-actions.ts`).
- `src/app/api/brev-samtale/route.ts` — strømmende AI-samtale (route handler).
- `src/app/api/cron/paaminnelser/route.ts` — daglig e-postvarsel-jobb
  (`lib/epost.ts` via Resend, `lib/supabase/admin.ts` service-role-klient).
- `src/app/{velkommen,konto,personvern}/` — onboarding, konto, personvern.
- `src/components/` — UI (Logo, Topplinje, Merker, AiBrevhjelp, DokumentNotat,
  MalKort/MalListe, SlettKonto m.fl.).
- `src/lib/` — `types.ts`, `dato.ts`, `maler.ts`.

## Personvern

Sensitive personopplysninger behandles etter GDPR: data lagres i EU-region, kun
tekst brukeren selv limer inn sendes til AI (Anthropic), og brukeren kan når som
helst slette alle egne data og hele kontoen under **Min konto**. AI gir aldri
autoritative vedtak og finner aldri opp frister, beløp eller paragrafer.
