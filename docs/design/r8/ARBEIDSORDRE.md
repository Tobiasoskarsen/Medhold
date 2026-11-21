# MEDHOLD R8 — Ryddigere, roligere app (arbeidsordre)

Til Claude Code / Codex. Les `AGENTS.md` først (Next.js-versjonen avviker; les `node_modules/next/dist/docs/` før du skriver kode) og følg `docs/testing/R3_RELEASE_GATE.md`. **Ingenting deployes til produksjon i denne ordren.** Kun Vercel preview.

## 0. Hvorfor

Eieren synes appen er rotete: mange små undertekster, like tunge elementer på samme skjerm, og den føles ikke som en ferdig iPhone-app. Målet er en profesjonell, rolig og smidig app som kan vises frem for NAV og banker, uten å miste Medholds identitet.

Prinsipper (gjelder alle valg i denne ordren):

1. **Ett hovedtema per skjerm.** Én primærhandling, ett stort tall. Alt annet er sekundært og stille.
2. **Tall og status i stedet for forklaringstekst.** Undertekster skal bare finnes når de endrer en beslutning.
3. **Fjerning av tekst må aldri fjerne sikkerhet.** Alle deterministiske advarsler (sumavvik, gammelt brev, alvorsvarsel, hovedstolavvik, beregnet frist, forbehold) beholdes. De kan flyttes, slås sammen eller foldes sammen, men aldri fjernes.
4. **Bevegelse skal hjelpe, ikke vise seg frem.** Ingen konfetti, aurora, glød eller «spill». Bare overganger, tellende tall og trykk-respons som allerede finnes i `src/lib/bevegelse.ts`.
5. **Ingen døde kontroller.** Bygg ikke knapper eller felt som ikke gjør noe ekte.

## 1. Referanser og bilder

Mappe: `docs/design/r8/` (samme mønster som `docs/design/r7/`).

- `prototype.dc.html`: kildekoden til den klikkbare prototypen. Den kan ikke åpnes direkte (trenger `support.js` fra designverktøyet), men er fasit for **eksakte verdier**: avstander, radier, størrelser, tekster og animasjonsvarigheter. Les den.
- Skjermbilder (PNG, lagt til av eieren): `01-hjem.png`, `02-sak-oversikt.png`, `03-sak-dokumenter.png`, `04-sak-historikk.png`, `05-meg.png`, `06-utkast.png`. Se `README.md` i mappen.
- Hvis et bilde mangler: bygg etter `prototype.dc.html` og denne teksten, og si fra i PR-beskrivelsen.

Fontene: **behold Schibsted Grotesk** (prototypen er tegnet med Geist, men forskjellen er liten; ikke bytt font).
Fargene: prototypen bruker allerede tokenene i `globals.css`. **Ikke innfør nye farger** unntatt tintene i §3.1.

## 2. Rekkefølge (fire PR-er, hver for seg, hver testet)

1. **PR 1:** tokens, `Primærknapp`, `BunnNav`
2. **PR 2:** Hjem
3. **PR 3:** Saker og Sak
4. **PR 4:** Utkast og Meg

Hver PR: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run test:db` grønne. Skjermbilder lys og mørk modus legges i `docs/design/r8/` med filnavn `pr<N>-<skjerm>-lys.png` / `-mork.png`. Oppdater tester som refererer til endret tekst eller struktur (spesielt `supabase/tests/saksvisning.test.mjs`).

## 3. PR 1 — Fundament

### 3.1 Tokens (`src/app/globals.css`)

- Legg til fire kreditor-tinter (rund initial-sirkel), lys og mørk, med kontrast ≥ 4.5:1 mellom `-tekst` og `-bg`:
  `--tint-1-bg/-tekst` (grønn), `--tint-2-…` (rav), `--tint-3-…` (blågrønn), `--tint-4-…` (rosa). Lys: `#dcebe5/#103c38`, `#fff1db/#7a4a00`, `#e3f5f2/#0f6b5f`, `#fde8ea/#9a1f2a`. Mørk: velg tilsvarende mørke bakgrunner og lyse tekster.
- Regn ut tint fra kreditornavn med en liten ren funksjon `tintFor(navn: string): 1|2|3|4` i `src/lib/` (stabil hash, samme navn = samme tint). Enhetstest.
- Oppdater kommentaren øverst i `globals.css`: «heltekortet er fjordgrønt» gjelder ikke lenger (heltekortet er allerede hvitt); fjordgrønn brukes på primærknapper, initialer og aktiv fane.

### 3.2 `Primærknapp`

- Alle varianter blir **pille** (`rounded-full`), høyde 52px, tekst 16px / 600.
- Sekundærknapp (ny variant `stille`): pille, bakgrunn `flate-2`, tekst `blekk`.
- Trykk-respons: behold `trykk`-klassen.

### 3.3 `BunnNav` (`src/components/ui/BunnNav.tsx`)

Fra flytende pille til **flat iOS-fane-linje**:

- Full bredde, `bg-nav-bg` med lett blur (`backdrop-blur`), hårstrek øverst (`border-t border-nav-kant`), safe-area nederst. Ingen ytre padding eller skygge.
- Tre punkter: **Hjem**, **Legg til** (midten), **Saker**. **Meg tas ut av fanelinjen** og nås via initial-knappen øverst til venstre på Hjem og Saker (§4, §5).
- «Legg til» er en 48px fjordgrønn sirkel (`bg-knapp text-knapp-tekst`) med plusstegn, løftet ca. 8px over linjen, med teksten «Legg til» under.
- Aktiv fane: `text-nav-aktiv`. Behold animert indikator (`layoutId`, `INDIKATOR_FJAER`) bare bak ikonet til Hjem/Saker.
- Behold: `aria-current`, haptikk, `FANE_NAV_NOKKEL`-flagget, skjuling når tastaturet er oppe, `usePathname`-logikken. Stiene `/meg/*` markerer ingen fane som aktiv.
- Oppdater `--nav-hoyde` / `--nav-luft` slik at innholdet ikke havner under menyen.

## 4. PR 2 — Hjem (`src/app/(app)/page.tsx`)

Se `01-hjem.png`. Fra topp til bunn:

1. **Toppstripe:** initial-knapp til venstre (40px rund, `bg-knapp`, initialer fra `brevnavn`/`fornavn`, lenker til `/meg`, `aria-label="Profil"`). **Ingen varselbjelle** (finnes ikke). Fjern «Hei, {navn}»-overskriften og ingressen fra visningen. `hjemIngress` i `lib/oversikt.ts` og testene beholdes urørt.
2. **Totalen (sentrert):**
   - Etikett «Utestående krav» (15px, `dempet`).
   - Tallet (44px, 700, tabular) i formatet `formaterKr`, **teller opp** ved første visning (bruk eksisterende `Belop`-telling og `VARIGHET`).
   - **Definisjon:** summen av `belop_totalt` for saker med status `aktiv` eller `venter_pa_svar`. `fullfort` er ikke med. `null`-beløp hoppes over. Legg beregningen som ren funksjon `utestaaendeTotal(saker)` i `src/lib/oversikt.ts` med tester (tom liste, null-beløp, blanding av statuser).
   - **Chip** «Mulig avvik: {sum} kr» (`bg-dom-rod-bg text-dom-rod`, 13px/600, chevron), vist **bare** når summen er > 0. Summen er `totalOver(overLinjer(gs))` fra nyeste brev per aktiv sak, kun for saker der `stotterUtkast(stadium)`. Ren funksjon `muligAvvikTotal(...)` med tester. Chipen lenker til saken med størst avvik. Ordlyden er «Mulig avvik», aldri «for mye» eller «ulovlig».
   - Henter nyeste brev med gebyrsjekk for alle aktive saker i **én** spørring (ingen N+1), samme sorteringsregel som sak-siden (`brevdato` desc nulls last, deretter `opprettet` desc).
3. **Hurtigrad:** tre runde knapper (54px, `bg-flate`): **Skann**, **Last opp**, **Lim inn**, etikett 13px under. Lenker til `/legg-til-brev?inntak=kamera|fil|tekst`. På den siden: `tekst` hopper rett til tekstfeltet; `kamera` og `fil` åpner steg 1 med det valgte kortet fremhevet (nettleseren tillater ikke å åpne filvelgeren uten trykk). **Ikke** bygg «Spør» (finnes ikke på hjem-nivå).
4. **Viktigste sak-kortet:** behold dagens grenlogikk (førstegang, medhold/seier, ingen saker, alvorlig, venter på svar, standard) og `rangerSaker`. Visuelt: hvitt kort, etikett øverst (13px/600: «Trenger oppfølging» i standardgrenen), kreditorrad med initial-sirkel (tint), navn, én statuslinje (frist eller «Venter på svar»), beløp til høyre, og **én** pilleknapp under («Se hva du kan gjøre»; «Lag svar» når gebyrfunn finnes). Fjern de små tilleggstekstene i kortet (frist-underkort og «Oppfølgingen er separat …» er allerede fjernet).
5. **Andre saker:** ett hvitt kort med rader (maks 3, som i dag): initial-sirkel (tint), navn, én statuslinje (14px), beløp. Ingen chevron. «Se alle» som stille lenke til `/krav`.
6. **Førstegang (ingen saker):** behold «Kom i gang»-kortet og «Slik fungerer det», restylet likt, uten ekstra undertekster.

Animasjon: behold `Sekvens`/`SekvensDel` (stagger). Ingen nye keyframes.

## 5. PR 3 — Saker og Sak

### 5.1 Saker (`src/app/(app)/krav/page.tsx`)

- Tittel «Saker» med initial-knappen (§4.1) høyre-justert på samme rad.
- Behold seksjonene (Trenger oppfølging / Venter på svar / Avsluttet) og gruppering, men rader som på Hjem. Ingen oversiktsstripe.
- Avsluttet med medhold: statuslinjen i `gull`-tokenet (gull brukes bare ved medhold).

### 5.2 Sak (`src/app/(app)/krav/[id]/page.tsx` og `Saksvisning`)

Se `02-sak-oversikt.png` til `04-sak-historikk.png`.

**Topp (sentrert):** tilbakeknapp (40px rund), initial-sirkel 56px, kreditornavn 17px/600, **beløpet 40px/700 som teller opp** (behold delt View-Transition fra sakskortet og `DELT_OVERGANG_NOKKEL`: ingen ny telling når flagget er satt), og under to piller: stadium («Betalingsoppfordring») og fristpille («Frist i morgen», rød via `erHastende`).

**Faner:** `Saksvisning` restyles til segmentert kontroll (Oversikt | Dokumenter | Historikk): spor `flate-2`, aktiv pille `flate` med lett skygge, **glidende indikator** (`layoutId`, `FJAER`). Behold antall («Dokumenter 2») som liten tekst bare hvis > 0.

**Oversikt, i denne rekkefølgen:**

1. Alvorsvarsel / `GammeltBrevKort` hvis de gjelder (uendret betingelse, oppå alt annet).
2. **Funnkort** (hvitt kort) når det finnes gebyrfunn eller sumavvik:
   - Etikett «Funn» med varselikon (`dom-rod`).
   - Overskrift (19px/600) fra eksisterende **deterministiske** funntekster (`gebyrfunn-visning.ts`): f.eks. «Inkassosalæret er 150 kr høyere enn loven tillater.» Ikke skriv ny tekst her; gjenbruk funksjonene.
   - Opp til tre linjer «I brevet / Høyeste sats» (tabular, høyre-justert), med «og {n} til» ved flere.
   - Sumavvik og hovedstolavvik vises som egne linjer i samme kort (aldri skjult).
   - Pilleknapp «Lag svar» (primær) og «Betalingsløsninger» (`stille`). Gebyrfunnet må fortsatt styre «Anbefalt»-logikken i `Veivalg`.
3. **Fristrad:** stille rad «Svarfrist · 12. november ›» som folder ut til dagens `FristRad`, `Utregning`, hjemmel og `FristKnapp` (fullfør). Merknaden «Beregnet fra brevet – kontroller datoen.» beholdes inne i utfoldingen.
4. Uten funn: `Veivalg` vises som i dag, men uten de lange beskrivelsene (en kort linje per valg).
5. Venter på svar: dagens kort beholdes, restylet.

**Ikke bygg** «Spør om saken …»-feltet fra prototypen. Det krever sakenivå-chat som ikke finnes. Legg det i `docs/design/r8/README.md` under «Senere».

**Dokumenter:** liste med ikonboks (40px, `tint-1`), tittel, dato. **Historikk:** tidslinje med punkter (dagens `Tidslinje`), restylet.

## 6. PR 4 — Utkast og Meg

### 6.1 Utkast (`.../utkast/UtkastFlyt.tsx`)

Se `06-utkast.png`. Kun visuelt, **ingen logikk, vakt eller lagring endres**:

- Overskrift «Svar til {kreditor}» (28px/700).
- Brevteksten på et hvitt «papir»-kort, 15.5px, line-height 1.55. Eksisterende strømming/skriveeffekt beholdes (`fase === "strømmer"`).
- Statuslinje øverst høyre: «Skriver svar …» med glidende tekst under generering, «Utkast klart» med hake etterpå (`pop`-bevegelse kun ved første visning, `VARIGHET.hurtig`).
- Primær: fullbredde pille «Åpne i e-post». Under: «Kopier» (hake i 1.6 s etter trykk) og «Jeg har sendt det» som `stille` piller side om side. «Lagre endringer» beholdes og vises bare når teksten er endret.
- «Sjekk før du sender» beholdes uendret i innhold. Forbeholdet (`FORBEHOLD`) står **én** gang nederst, 13px, sentrert.

### 6.2 Meg (`src/app/(app)/meg/*`)

Se `05-meg.png`.

- Tilbakeknapp øverst til venstre (Meg er ikke lenger en fane).
- `ProfilKort`: sentrert avatar 72px (initialer), navn 22px/700, e-post 15px `dempet`. Redigering av brevnavn og telefon beholdes, men bak en rad «Brevnavn og telefon» som folder ut (`Utvidbar`).
- Gruppe 1: **E-postpåminnelser** som iOS-bryter (52×32, hvit knott som glir med `FJAER`, bakgrunn `knapp`/`strek`), og **Utseende** som rad med nåværende valg til høyre («Følg telefonen» / «Lyst» / «Mørkt») som folder ut velgeren (`TemaRad`).
- Gruppe 2: Satsene vi bruker, Alle brev, Kontakt support, Personvern og data (rader med chevron, hårstrek mellom).
- «Logg ut» som eget kort, tekst i `dom-rod`. «Slett konto» beholdes nederst, liten og rolig.
- Bunnlinje: «Medhold {versjon} · Ikke profesjonell rådgivning» (13px).

## 7. Bevegelse

Bruk bare det som finnes: `Sekvens`, `Belop`-telling, `FJAER`, `VARIGHET`, `INDIKATOR_FJAER`, `trykk`, ruteovergangen i `template.tsx`. Nye mikrobevegelser (segmentindikator, bryterknott, hake) bruker samme tokens. Ingen hardkodede varigheter eller easing i komponenter. `prefers-reduced-motion` skal gi null bevegelse (testes manuelt).

## 8. Ikke gjør

- Ikke endre server-logikk, RLS, migrasjoner, kvoter, AI-kall, gebyr/frist-regler eller utkastvakter.
- Ikke fjern noen advarsel eller noe forbehold (prinsipp 3).
- Ikke bygg chat/«Spør»-felt, varselbjelle eller betalingsark.
- Ikke innfør nye farger, fonter eller animasjonsbibliotek.
- Ikke aktiver pilot-bryteren eller endre Pluss-logikk.
- Ikke merge til `main` og ikke deploy til produksjon.

## 9. Ferdig når

- Alle fire PR-er har grønn lint, typecheck, `npm test` og `npm run test:db`.
- Hjem, Saker, Sak (alle tre faner), Utkast og Meg er verifisert i Vercel preview på mobilbredde (390px) i **lys og mørk** modus, med skjermbilder i `docs/design/r8/`.
- Tester dekker `utestaaendeTotal`, `muligAvvikTotal` og `tintFor`.
- Tastaturnavigasjon og VoiceOver-navn (`aria-label`) fungerer på avatar-knapp, bunnmeny, segmentert kontroll og bryter.
- Kontrast ≥ 4.5:1 for all tekst, målt i begge temaer.
- PR-beskrivelsen lister hva som bevisst ikke er gjort (§5.2 «Spør», hurtigrad-begrensningen for kamera/fil).
