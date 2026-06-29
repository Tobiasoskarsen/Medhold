# Krisenavigator

Et verktøy for å holde oversikt over saker, frister og neste steg i en vanskelig
periode. Web-app bygget med Next.js 16 (App Router), TypeScript, Tailwind og
Supabase.

> Dette er et organiseringsverktøy — ikke en offentlig tjeneste og ikke
> profesjonell rådgivning.

## Status

- **Fase 0 (ferdig):** oppsett, e-post-innlogging via Supabase Auth, beskyttet
  «Mine saker»-side.
- **Fase 1 (ferdig):** saker med full CRUD (opprett, les, oppdater, slett),
  statusfilter på listen, detalj- og redigeringsside. Alt beskyttet av RLS.
- **Fase 2 (ferdig):** frister (med dato + hastegrad) og neste steg (oppgaver)
  per sak, avkryssing som fullført, og en samlet «Kommende frister»-oversikt på
  forsiden på tvers av alle saker.
- **Fase 3 (ferdig):** AI-hjelp inne i en sak — lim inn et brev, få forklaring
  på enkelt norsk + foreslåtte steg/frister du kan legge til med ett klikk.
  Kun det du limer inn sendes til Anthropic (server-side). Krever
  `ANTHROPIC_API_KEY` i `.env.local`.
- **Fase 4 (ferdig):** polish og trygghet — felles topp/bunn med fast
  disclaimer, personvernerklæring (`/personvern`), og «Min konto» (`/konto`)
  med bekreftet sletting av all egen data + konto (GDPR). v1 er ferdig.
- **v1.1 (ferdig):** samtale-per-brev — still oppfølgingsspørsmål til en
  brevforklaring (f.eks. «oversett til engelsk») med strømmende AI-svar, slett
  enkelt-forklaring, og utfellbar originaltekst. Deployet på Vercel.

## Kom i gang lokalt

### 1. Opprett Supabase-prosjekt (EU-region — viktig for GDPR)

1. Gå til <https://supabase.com>, logg inn, og klikk **New project**.
2. Velg en **EU-region** (f.eks. `Frankfurt (eu-central-1)` eller
   `Stockholm`). Dette er et krav fordi appen behandler sensitive data.
3. Vent til prosjektet er klart.

### 2. Hent nøklene

I Supabase-prosjektet: **Project Settings → API**.

- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon` / `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Legg dem i `.env.local` (filen finnes allerede med plassholdere; den er
gitignored og skal aldri committes).

### 3. Skru på e-post-innlogging

I Supabase: **Authentication → Providers → Email** skal være på.

- For raskest mulig testing lokalt kan du midlertidig skru **av** «Confirm
  email», så slipper du å bekrefte via e-post. Skru den på igjen før produksjon.
- Hvis «Confirm email» er på, sender Supabase en bekreftelseslenke. Sett
  **Authentication → URL Configuration → Site URL** til `http://localhost:3000`
  og legg `http://localhost:3000/auth/confirm` til i **Redirect URLs**.

### 4. Kjør databasemigrasjonen

Åpne **SQL Editor** i Supabase og kjør migrasjonene i `supabase/migrations/` i
rekkefølge (`0001_saker.sql`, `0002_frister_neste_steg.sql`,
`0003_document_note.sql`, `0004_slett_konto.sql`, `0005_brev_samtale.sql`). De
oppretter tabellene `saker`, `frister`, `neste_steg`, `document_note` og
`brev_samtale` (alle med row-level security), og funksjonen `slett_egen_konto()`
for GDPR-sletting.

### 5. Kjør

```bash
npm install
npm run dev
```

Åpne <http://localhost:3000>. Du sendes til `/login`. Registrer deg, logg inn,
og du havner på den (foreløpig tomme) «Mine saker»-siden.

## Arkitektur (kort)

- `src/lib/supabase/client.ts` — Supabase-klient for nettleseren (Client
  Components).
- `src/lib/supabase/server.ts` — Supabase-klient for serveren (Server
  Components, Route Handlers).
- `src/lib/supabase/middleware.ts` — fornyer session og beskytter ruter.
- `src/proxy.ts` — Next.js proxy (tidl. middleware) som kjører session-logikken.
- `src/app/login/page.tsx` — innlogging og registrering.
- `src/app/auth/confirm/route.ts` — bekrefter e-postlenke.
- `src/app/auth/signout/route.ts` — logg ut.
- `src/app/saker/page.tsx` — beskyttet «Mine saker»-side.

## Personvern

Appen behandler sensitive personopplysninger og følger GDPR: data lagres i
EU-region, kun det brukeren selv limer inn sendes til AI (kommer i Fase 3), og
brukeren skal kunne slette egne data (kommer i Fase 4).
