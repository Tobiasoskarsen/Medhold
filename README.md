# Medhold

Medhold hjelper privatpersoner å holde oversikt over **gjelds- og inkassosaker**
over tid — tidslinje, samlet oversikt og neste steg — og å forstå brevene som
kommer. Kjerneidéen er saken over tid, ikke enkeltbrevet. Web-app bygget med
Next.js 16 (App Router), TypeScript, Tailwind v4, Supabase og Anthropic.

> Dette er et organiseringsverktøy — ikke en offentlig tjeneste og ikke
> juridisk eller økonomisk rådgivning.

## Prinsipp: «AI tolker, kode beslutter»

AI-en **trekker ut** fakta fra brev (kun det som står eksplisitt) og forklarer
på enkelt norsk. All **vurdering** — frister, stadium, utfall, gebyrkontroll —
skjer i ren, testet TypeScript uten AI. AI finner aldri opp frister, beløp eller
paragrafer.

## Funksjoner

- **Krav (saker) over tid:** hvert krav har en tidslinje av brev, frister,
  utkast og utfall, med et stadium (faktura → purring → inkassovarsel →
  betalingsoppfordring → forliksråd → namsmann → nedbetaling → avsluttet).
  Opprett krav fra et brev, eller manuelt uten brev. Alt beskyttet av
  row-level security.
- **Brevinntak** på tre måter: ta bilde, last opp bilde/PDF, eller lim inn
  tekst. Bilder/PDF leses med Claude vision; kun den transkriberte teksten
  lagres, ikke bildet.
- **Brevanalyse:** forklaring på enkelt norsk + uttrekk av brevtype, avsender,
  dato, beløp, saksnummer og kostnadslinjer. Beregnede frister (inkassoloven
  §§ 9–10) lages i kode.
- **Gebyrsjekk:** deterministisk kontroll av gebyrer og inkassosalær mot
  inkassoforskriftens maksimalsatser (`src/lib/gebyr.ts`, versjonert satstabell).
  Panel på brevet, «Mulig ulovlig gebyr»-varsel på kravet, og funnene mates inn
  i svarutkastet som fakta.
- **Samtale per brev** med strømmende svar for oppfølgingsspørsmål.
- **Svarutkast** (innsigelse / betalingsutsettelse / klage): kodegenerert,
  redigerbart brev du sender selv via din egen e-postklient. Appen sender aldri
  noe til kreditor.
- **Lukke løkka:** «Jeg har sendt det» → saken venter på svar → automatisk
  oppfølging via cron etter 14 dager → registrering av utfall (medhold /
  delvis / avvist / nedbetalingsavtale).
- **Påminnelser** før frister (7/3/1 dag før forfall) via daglig Vercel Cron og
  Resend.
- **Innlogging** med engangskode (OTP) på e-post eller SMS — ingen passord.
- **Mørk modus**, bevegelsesspråk (motion), personvernerklæring og **«slett all
  data + konto»** (GDPR).

Deployet på Vercel: <https://app2-chi-five.vercel.app>

## Arkitektur (kort)

- `src/app/(app)/` — innloggede skjermer med bunn-navigasjon: Hjem (`page.tsx`),
  Krav (`krav/`), Krav-detalj (`krav/[id]/`), nytt krav (`krav/ny/`), brevarkiv
  (`brev/`), Meg (`meg/`), Pluss (`pluss/`). Delt `layout.tsx` med auth-vakt.
- `src/app/{velkommen,logg-inn,intro,legg-til-brev,personvern}/` — offentlige og
  fullskjerms-flyter.
- `src/app/api/brev-samtale/route.ts` — strømmende AI-samtale.
- `src/app/api/cron/paaminnelser/route.ts` + `oppfolging` — daglige jobber
  (service-role-klient, Bearer-secret).
- `src/lib/` — ren, testet logikk: `gjeld.ts` (stadium/frister), `gebyr.ts`
  (gebyrsjekk), `utfall.ts`, `oppfolging.ts`, `plan.ts` (Pluss-gating),
  `ai.ts` (modell-konstant), `epost.ts`, `telefon.ts`, `dato.ts`, `format.ts`,
  `brand.ts`, `bevegelse.ts`, `haptikk.ts`, `types.ts`.
- `src/components/ui/` — komponentbibliotek (Kort, Pill, knapper, tidslinje …).
- `src/proxy.ts` — Next.js proxy (erstatter middleware): fornyer session,
  beskytter ruter.

Enhetstester ligger som `*.test.ts` i `src/lib/` og kjøres med `npm test`
(Node innebygde test-runner).

## Kom i gang lokalt

### 1. Opprett Supabase-prosjekt (EU-region — viktig for GDPR)

<https://supabase.com> → **New project**, velg en **EU-region** (f.eks. Frankfurt
eller Stockholm). Appen behandler sensitive data.

### 2. Miljøvariabler i `.env.local` (gitignored, aldri committet)

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase →
  Project Settings → API).
- `ANTHROPIC_API_KEY` (kun server-side — aldri `NEXT_PUBLIC_`-prefiks).
- `SUPABASE_SERVICE_ROLE_KEY` (hemmelig — brukes kun av cron-jobbene).
- `RESEND_API_KEY`, `VARSEL_FRA_EPOST` (avsender) for e-post. Uten verifisert
  domene sender Resend kun til din egen konto-e-post fra `onboarding@resend.dev`.
- `CRON_SECRET` (tilfeldig streng du velger) — sikrer cron-rutene.
- `NEXT_PUBLIC_APP_URL` (lenker i e-post).
- `NEXT_PUBLIC_PILOT=true` for pilotmodus (alt gratis; skrur av Pluss-paywall).

### 3. Innlogging (OTP)

I Supabase, **Authentication → Providers**: skru på **Email**. For SMS-innlogging
konfigurer **Phone** med en SMS-provider (Twilio). Koden sendes via Resend
(e-post) fra egen server-action; se `src/app/logg-inn/actions.ts`.

### 4. Kjør databasemigrasjonene

Åpne **SQL Editor** i Supabase og kjør alt i `supabase/migrations/` i rekkefølge
(`0001` … `0018`). De oppretter tabellene (`saker`, `brev`, `frister`,
`neste_steg`, `brev_samtale`, `utkast`, `sendte_oppfolginger`, `sendte_varsler`,
`profiler` m.fl., alle med row-level security), gebyrsjekk-kolonnene på `brev`,
og `slett_egen_konto()` for GDPR-sletting.

### 5. Kjør

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # enhetstester
npm run lint
```

Åpne <http://localhost:3000>. Du sendes til `/velkommen`, deretter innlogging med
engangskode.

## Deploy (Vercel)

Legg miljøvariablene på Vercel-prosjektet (Production), inkludert
`NEXT_PUBLIC_PILOT=true` for pilot. Deretter `vercel --prod`. Cron-jobbene
registreres fra `vercel.json` (Vercel sender `Authorization: Bearer
<CRON_SECRET>`). Sett Supabase **Site URL / Redirect URLs** til prod-domenet.
Kjør nye migrasjoner i Supabase **før** deploy.

> ⚠️ Vercel-env-vars fra PowerShell: å pipe verdien til `vercel env add` kan
> legge inn et usynlig BOM-tegn og krasje appen. Skriv heller verdien til en
> BOM-fri fil, eller lim inn i Vercel-dashbordet. Verifiser med
> `vercel env pull`.

> ⚠️ Strømmende/AI-ruter har `export const maxDuration = 60` — Vercels
> standardgrense (~10s på Hobby) kutter ellers lange AI-svar.

## Personvern

Data lagres i EU-region. Kun tekst som sendes til analyse går til AI (Anthropic):
innlimt brevtekst, eller bilder/PDF ved bildeinntak (bildet lagres ikke, kun den
transkriberte teksten). AI gir aldri autoritative vedtak og finner aldri opp
frister, beløp eller paragrafer. Brukeren kan når som helst slette alle egne data
og hele kontoen under **Meg**. Se `/personvern` for full erklæring.
