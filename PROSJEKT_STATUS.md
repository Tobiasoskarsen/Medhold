# PROSJEKT_STATUS.md

Løpende status for implementeringen av `MEDHOLD_ARBEIDSORDRE.md`. Oppdateres
etter hver fase.

## Faseoversikt

| Fase | Beskrivelse | Status |
|---|---|---|
| 0 | Rebrand + designfundament | ✅ Ferdig |
| 1 | Datamodell | ✅ Ferdig (migrasjoner ikke kjørt i Supabase ennå) |
| 2 | Skjermene | ✅ Ferdig (krever at migrasjonene kjøres for å funke live) |
| 3 | Saksbehandleren | ✅ Ferdig (migrasjoner 0013–0014 må kjøres) |
| 4 | Inntak og posisjonering | ⬜ Ikke startet |
| 5 | Ekte betaling | 🔒 Låst (krever egen beskjed) |

---

## Fase 0 — Rebrand + designfundament (ferdig)

Levert:

- `src/lib/brand.ts` med `APP_NAME = 'Medhold'`. Alle «Klarvei»-forekomster i
  UI, metadata, e-postmaler, `types.ts` og `README.md` er erstattet (verifisert
  med søk — ingen igjen).
- Logo-filer fra spec 1.1: `public/logo-ikon.svg`, `public/logo.svg`,
  `public/logo-morkt.svg`. `src/app/icon.svg` og `src/components/Logo.tsx`
  oppdatert til Medhold-merket.
- PWA-ikoner `public/ikon-192.png` og `public/ikon-512.png` generert fra
  `logo-ikon.svg`.
- Inter via `next/font/google` erstatter Geist i `layout.tsx`.
- Designtokens (2.1) i `globals.css`, eksponert som Tailwind-farger
  (`bg-bakgrunn`, `text-blekk`, `border-strek`, `bg-aksent`, `bg-varsel-bg` …)
  via `@theme inline`. `prefers-reduced-motion` respekteres.
- Komponentbibliotek i `src/components/ui/` med barrel-eksport (`index.ts`):
  `Skjermramme`, `Kort`, `Primærknapp`, `Pillknapp`, `Pill`, `BunnNav`,
  `StadiumIndikator`, `Tidslinje` + `TidslinjeHendelse`.
- `npm run build` og `npm run lint` grønne. Boot verifisert i preview (375px):
  Inter aktiv, `bg-bakgrunn` = #F7F7F5, tittel «Medhold», ingen «Klarvei».

Valg tatt underveis (per arbeidsordrens instruks om å notere tvetydigheter):

1. **Designreferanser er HTML-mockups**, ikke PNG-filer. De ligger i
   `design/` i app2-roten (`medhold_hjem_skjerm_mockup.html`,
   `medhold_krav_detalj_mockup.html`, `medhold_velkomst_innlogging_mockup.html`).
   Brukt som visuell fasit.
2. **Favicon:** `sharp` er tilgjengelig, men skriver ikke `.ico`. Gammel
   `src/app/favicon.ico` (utdatert merke) er slettet; `src/app/icon.svg`
   (SVG) er nå faviconkilde (Next serverer den med `sizes="any"`).
3. **PWA-manifest** er ikke koblet inn ennå — ikonene finnes, men selve
   `manifest`-fila fullføres i Fase 4 (per faseplan pkt. 4).
4. **Gammel `slate`-remapping beholdt** i `globals.css` slik at eksisterende
   skjermer (dashbord, saksside, login) ikke regreder før de erstattes i
   Fase 2. Fjernes da.
5. **Komponentfilnavn er ASCII** (f.eks. `Primaerknapp.tsx`) med norske
   eksportnavn (`Primærknapp`), for å unngå encoding-fnugg på tvers av verktøy.
   Skjermer importerer fra `@/components/ui`.
6. **`BunnNav` bruker rutene** `/`, `/krav`, `/meg` (opprettes i Fase 2).
   Komponenten er ikke montert ennå.
7. **`Tidslinje`/`StadiumIndikator` er implementert som presentasjonelle
   komponenter** (ikke tomme), siden mockupene er tydelige. Datakobling skjer
   i Fase 2.
8. **Miljø:** `.env.local` er kopiert inn i worktreen (gitignorert) for å
   kunne kjøre `dev`/`build` lokalt.

Kjent, ufarlig: Next advarer om «multiple lockfiles» fordi worktreen har egen
`package-lock.json` i tillegg til app2-roten. Påvirker ikke bygget.

---

## Fase 1 — Datamodell (ferdig)

Levert (seksjon 4 + seksjon 6):

- Migrasjoner `supabase/migrations/0007–0012`:
  - `0007_saker_gjeld.sql` — `saker` utvidet med kreditor, opprinnelig_kreditor,
    saksnummer, belop_hovedstol, belop_totalt, stadium (alle nullable).
  - `0008_brev.sql` — ny `brev`-tabell m/ RLS + datamigrering fra
    `document_note` (**samme id-er beholdes**, idempotent).
  - `0009_frister_kilde.sql` — `frister.kilde`
    (manuell/brev_eksplisitt/beregnet) + `frister.brev_id`.
  - `0010_brev_samtale_brev_id.sql` — `brev_samtale.brev_id` (additivt, fylt
    fra `document_note_id`).
  - `0011_profiler.sql` — `profiler`-tabell (plan gratis/pluss) m/ RLS.
  - `0012_slett_egen_konto_utvidet.sql` — dekker nå brev, brev_samtale,
    profiler m.fl. eksplisitt (guardrail).
- `src/lib/gjeld.ts` — STADIER, `nesteStadium`, `foreslaStadium`,
  `fylteSegmenter`, `leggTilDager`, `beregnFrist` (inkassovarsel/
  betalingsoppfordring → +14 dager, kilde='beregnet'). 9 enhetstester i
  `src/lib/gjeld.test.ts`, kjøres med `npm test` (Node innebygd test-runner).
- `src/lib/plan.ts` — `harPluss(brukerId)` (eneste gating-inngang), `erPilot()`,
  `PLUSS_PRIS`. Pilotmodus via `NEXT_PUBLIC_PILOT`.
- `src/lib/types.ts` oppdatert: Sak-gjeldfelter, `Brev`, `FristKilde` +
  Frist.kilde/brev_id, `Plan`/`Profil`.
- `npm run build`, `npm run lint`, `npm test` grønne.

Valg tatt underveis:

1. **Additiv migrering, ikke hard cutover.** `document_note` og
   `brev_samtale.document_note_id` beholdes side om side med `brev`/`brev_id`
   slik at den gamle sakssiden fortsatt virker fram til Fase 2. `brev` får
   samme id-er som `document_note`, så koblingen bevares. **Opprydding (drop
   document_note, gjør brev_id NOT NULL, drop document_note_id) gjøres i Fase 2**
   når de gamle skjermene fjernes.
2. **⚠ Migrasjonene 0007–0012 er skrevet, men IKKE kjørt i Supabase ennå.**
   De bør kjøres i SQL Editor (i rekkefølge) sammen med Fase 2, siden det er
   Fase 2-koden som først bruker de nye tabellene. Kjøres de nå, er det trygt
   (additivt), men ingen effekt før skjermene finnes.
3. **Enhetstester:** ingen test-runner fantes; bruker Node sin innebygde
   (`node --test`, Node 24 stripper TS-typer). `*.test.ts` er ekskludert fra
   `tsconfig` (unngår `.ts`-import-konflikt) og fra Next-bygget.
4. **`NEXT_PUBLIC_PILOT=true`** lagt i lokal `.env.local`. **Må settes i Vercel**
   (og din ekte `.env.local`) for at pilotmodus skal gjelde i prod. Uten den
   defaulter `harPluss` til gratis — uten effekt før gating tas i bruk (Fase 3).
5. **`slett_egen_konto`** trengte strengt tatt ikke endring (cascade dekker
   alt), men eksplisitte deletes er lagt til for å oppfylle guardrailen og tåle
   framtidige tabeller uten cascade.

---

## Fase 2 — Skjermene (ferdig)

Ny rutestruktur:
- `(app)/` route group (auth-vakt + `BunnNav` + ansvarsfraskrivelse): `/` (Hjem),
  `/krav` (liste), `/krav/[id]` (detalj m/ tidslinje), `/meg`.
- Offentlig: `/velkommen` (3.7), `/logg-inn` (e-post-OTP), `/personvern`.
- `/legg-til-brev` (fullskjerm flyt, utenfor (app) — ingen BunnNav).
- Slettet: `/saker/*`, `/login`, `/konto/*` + ubrukte komponenter (AiBrevhjelp,
  DokumentNotat, SakSkjema, Mal*, Merker, Topplinje, Bunntekst, LeggTilFrist/
  Steg-skjema, AutoSubmitAvkryssing) og `lib/maler.ts`.

Auth: middleware sender uinnlogget → `/velkommen`, innlogget bort fra
velkomst/innlogging → `/`. Onboarding-redirect fjernet (onboarding = første
brev). auth/confirm + signout retarget. Innlogging via `signInWithOtp`
(engangskode, `shouldCreateUser: true`); passord-UI fjernet (Supabase-støtten
urørt for eksisterende kontoer).

Verifisert mot mockups (380px): `/velkommen` og `/logg-inn` live (matcher).
Hjem-kortet og Krav-detalj-tidslinjen verifisert via en midlertidig
mock-forhåndsvisning (fjernet igjen), siden live authed-skjermer krever at
migrasjonene er kjørt + innlogging. `npm run build/lint/test` grønne.

Valg / avvik tatt underveis:

1. **Hjem-primærknapp = «Se saken»** (ikke «Lag utkast til svar»). Utkast er
   Fase 3 og gated via `harPluss()`. Da byttes verbet og «Se hele saken»-lenka
   kommer tilbake. Droppet den doble lenka nå.
2. **«Legg til brev» bruker dagens analyse** (forklaring/steg/eksplisitte
   frister). brevtype/avsender/beløp fylles manuelt i steg 3. Auto-uttrekk +
   krav-matching (5.1) + **beregnede** frister kobles i **Fase 3**. Eksplisitte
   frister lagres med `kilde='brev_eksplisitt'`.
3. **«Ta bilde» / «Last opp»** vises ikke (Fase 4) — kun tekst-innliming.
4. **Tidslinjen er presentasjonell** (brev-hendelser + frist-piller + løse
   frister). «Trykk for å åpne brevets forklaring/samtale» er **Fase 3**
   (sakskontekst i samtalen). `api/brev-samtale` og `document_note` er urørt
   inntil da.
5. **Krav-redigering/-sletting** bak `MoreVertical`: sletting implementert.
   Egen «rediger krav»-skjerm finnes ikke i mockupene → utelatt.
6. **«Logg ut» lagt til på Meg** — avvik fra «ingen andre elementer» i 3.6, men
   nødvendig funksjon. Diskret, dempet. Flagges her.
7. **`.next` måtte slettes** etter ruteomlegging (stale route-typer pekte på
   `/saker`) — kjent gotcha.

⚠ **Authed-skjermene feiler mot live-DB til migrasjonene 0007–0012 er kjørt**
(de spør etter kreditor/stadium/brev som ikke finnes ennå). Kjør dem i Supabase
SQL Editor før du logger inn og tester.

---

## Fase 3 — Saksbehandleren (ferdig)

**5.1 Utvidet analyse + matching:** `SVAR_SKJEMA` utvidet med brevtype (enum),
avsender, brevdato, belop, saksnummer — «kun eksplisitt»-regelen beholdt.
Etter analyse i kode: `beregnFrist(brevtype, brevdato)` (inkassoloven §§ 9–10)
kjøres, og brevet matches mot eksisterende krav (saksnummer → kreditor/avsender,
case-insensitivt). «Legg til brev»-steg 3 forhåndsfyller feltene, forhåndsvelger
matchet krav, og viser beregnet frist som egen av/på-rad («beregnet — sjekk
brevet»). Frister lagres med riktig `kilde`; kravet oppdateres med stadium/beløp/
saksnummer ved lagring.

**5.3 Utkast + paywall + gating:** migrasjon `0013_utkast.sql` (utkast-tabell +
RLS, `slett_egen_konto` utvidet). `lagUtkast(sakId, brevId, type, detaljer)`
gated via `harPluss()`. Utkast-skjerm `/krav/[id]/utkast` (type-valg + kort
skjema → generert, redigerbar tekst + «Kopier» + fast «send det selv til …»).
Utkast lagres som tidslinjehendelse. Paywall `/pluss` (tre punkter + pris fra
`PLUSS_PRIS`; i pilotmodus «Alt er gratis i pilotperioden»). Hjem-kortet viser
nå «Lag utkast til svar» + «Se hele saken» når stadiet støtter utkast.

**5.2 Sakskontekst i samtalen:** `api/brev-samtale` repekt til `brev`/`brev_id`
med sakskontekst (kreditor, stadium, beløp, tidligere brev) hentet server-side
under RLS og lagt i systemprompten. Ny brev-detaljskjerm
`/krav/[id]/brev/[brevId]` (forklaring + original + strømmet samtale);
tidslinjens brev-hendelser lenker hit. `0014_drop_document_note.sql` fullfører
cutoveren (brev_id NOT NULL, dropper document_note + kolonnen), og fjerner
document_note fra `slett_egen_konto`.

`npm run build/lint/test` grønne.

Valg / avvik:

1. **Utkast lagres i egen `utkast`-tabell** (ikke gjenbruk av brev/steg) — reneste
   tidslinjehendelse. Vises som stille hendelse på kravet.
2. **Utkast-skjema = ett fritekstfelt** hvis ledetekst varierer med type
   (uenig i / betale per måned / hvorfor feil), per 5.3. Tomt felt nevnes ikke.
3. **Gating dobbelt:** både `lagUtkast` og `/krav/[id]/utkast`-siden sjekker
   `harPluss()`. Pilotmodus (NEXT_PUBLIC_PILOT) → alltid tillatt nå.
4. **Oversett-knappene** fra gamle DokumentNotat er ikke tatt med — ikke i
   Medhold-spec. Samtalen støtter fortsatt «oversett til …» som vanlig spørsmål
   (dir="auto" for RTL).
5. **`document_note` droppes i 0014** — kjør den ETTER at Fase 3-koden er i drift
   (koden bruker kun `brev` nå).

⚠ **Migrasjonene 0007–0014 må kjøres i Supabase (i rekkefølge)** før authed-
skjermene virker mot live-DB. 0013–0014 er nye i denne fasen.

---

## Neste økt

**Fase 4 — Inntak og posisjonering:** bildeinntak (5.4, foto/PDF → Claude
vision, maks 2 bilder, lagre kun tekst), aktiver «Ta bilde»/«Last opp» i flyten,
gjeld-først landingsside, komplett PWA-manifest. (Fase 5 = ekte betaling er
låst til egen beskjed.)
