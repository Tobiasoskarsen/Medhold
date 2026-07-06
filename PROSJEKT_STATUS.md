# PROSJEKT_STATUS.md

Løpende status for implementeringen av `MEDHOLD_ARBEIDSORDRE.md`. Oppdateres
etter hver fase.

## Faseoversikt

| Fase | Beskrivelse | Status |
|---|---|---|
| 0 | Rebrand + designfundament | ✅ Ferdig |
| 1 | Datamodell | ✅ Ferdig (migrasjoner ikke kjørt i Supabase ennå) |
| 2 | Skjermene | ⬜ Ikke startet |
| 3 | Saksbehandleren | ⬜ Ikke startet |
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

## Neste økt

**Fase 2 — Skjermene:** Velkomst + innlogging med engangskode (3.7),
navigasjon (3.1), Hjem (3.2), Krav-liste (3.4), Krav-detalj m/ tidslinje (3.3),
«Legg til brev»-flyt med tekst-innliming (3.5), Meg (3.6). Gammel dashbord-/
saksside-layout og passord-UI slettes når nye er i drift. **Kjør migrasjonene
0007–0012 i Supabase som del av denne fasen**, og gjør den utsatte
document_note-oppryddingen (valg 1 over).
