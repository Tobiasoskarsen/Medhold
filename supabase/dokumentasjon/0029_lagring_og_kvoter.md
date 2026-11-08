# Migrasjon 0029: dato-bevisst og idempotent lagring, og kvoter

Fil: `supabase/migrations/0029_lagring_og_kvoter.sql`
Del av Pakke A (A2, A3, A4). **Ikke kjørt i Supabase.** Testet lokalt mot Postgres (PGlite).

## 1. Nye objekter

### Tabeller

| Tabell | Formål | Kolonner |
|---|---|---|
| `lagringsforsok` | Kvittering per lagringsforsøk (A3) | `bruker_id` uuid → auth.users (cascade), `nokkel` uuid, `sak_id` uuid → saker (cascade), `resultat` jsonb, `opprettet` timestamptz |
| `kvoter` | Sentrale grenser (A4) | `handling` text PK, `grense` int ≥ 0, `vindu_sekunder` int > 0, `beskrivelse` text, `oppdatert` timestamptz |
| `kvotebruk` | Én rad per reservasjon (A4) | `id` identity PK, `gruppe` uuid, `handling` → kvoter, `nokkel` text (1–128), `bruker_id` → auth.users (cascade), `forsok` uuid, `status` (reservert/brukt/frigitt), `gjentak` int, `opprettet`, `avsluttet`, `modell`, `inn_tokens`, `ut_tokens`, `ai_kall`, `varighet_ms`, `feil` |

`kvotebruk` inneholder ingen tekst fra brev, AI-svar eller brukeren. `nokkel` er bruker-id eller en HMAC-SHA256 av e-post/IP. Check-constraints sikrer at `modell` og `feil` bare kan være korte koder.

### Indekser og constraints

- `lagringsforsok_pkey (bruker_id, nokkel)`: hindrer to kvitteringer for samme forsøk.
- `lagringsforsok_sak_id_idx`
- `kvoter_pkey`, `kvotebruk_pkey`
- `kvotebruk_telling_idx (handling, nokkel, opprettet desc)`: brukes til tellingen.
- `kvotebruk_gruppe_idx`, `kvotebruk_bruker_idx`
- `kvotebruk_forsok_idx (handling, nokkel, forsok) where forsok is not null`: oppslag for gjentatte forsøk. Den er ikke unik, fordi samme innhold skal kunne analyseres igjen senere.

### Funksjoner

| Funksjon | Hvem kan kalle | Hva |
|---|---|---|
| `brev_datovurdering(date, date)` | authenticated | Gir `nyest`, `eldre`, `lik` eller `mangler`. Samme regel som `vurderBrevdato` i `src/lib/brevdato.ts`; en test sjekker at de er like. |
| `lagre_brev(jsonb)` (erstattes) | authenticated | Som 0027, pluss A2 og A3 (se under). |
| `reserver_kvote(jsonb, uuid, int)` | **bare service_role** | Reserverer kvote under advisory-lås. |
| `fullfor_kvote(uuid, boolean, jsonb)` | **bare service_role** | Markerer en reservasjon som brukt eller frigitt, med målinger. |

### Startverdier i `kvoter`

| handling | grense | vindu |
|---|---|---|
| dokumentanalyse | 5 | 24 t |
| chat | 20 | 24 t |
| utkast | 3 | 24 t |
| innlogging_epost | 5 | 1 t |
| innlogging_ip | 30 | 1 t |

Justeres med f.eks. `update public.kvoter set grense = 10 where handling = 'dokumentanalyse';`. Ingen kodeendring eller deploy trengs. Kjøres migrasjonen på nytt, beholdes justerte verdier (`on conflict do nothing`).

## 2. Endret oppførsel i `lagre_brev`

- **A2, dato:** For en eksisterende sak sammenlignes brevdatoen med `max(brevdato)` for sakens brev.
  - `nyest`: beløp, stadium og saksnummer oppdateres som før.
  - `eldre`, `lik`, `mangler`: bare tomme felt fylles, med mindre `oppdater_sak = true`. Det settes når brukeren krysser av for «bruk likevel».
  - Udaterte brev teller ikke i sammenligningen. Med den nye regelen endrer de aldri saken selv.
  - Status og utfall følger brukerens valg som før, uavhengig av dato.
  - Tom `brevdato` lagres som null.
- **A3, idempotens:** Med `nokkel` låses `(bruker, nokkel)` med `pg_advisory_xact_lock`. Finnes en kvittering, returneres samme resultat med `gjentatt: true`, og ingenting lagres. Ellers lagres alt, og kvitteringen skrives i samme transaksjon. Feiler lagringen, finnes ingen kvittering, og samme nøkkel kan prøves igjen.
- Nøkkelen sjekkes før `MEDHOLD_SAK_ENDRET`, så et nytt forsøk på et brev som allerede ble lagret får samme svar, ikke «saken er endret».
- Uten `nokkel` virker funksjonen som før. Gammel kode fungerer derfor i perioden mellom migrasjon og deploy.
- Svaret har nye felt: `datovurdering`, `sak_oppdatert`, `gjentatt`.

## 3. Påvirkning på eksisterende data

- Ingen eksisterende rader endres, slettes eller flyttes. Det er testet: tilstanden er lik før og etter, også når migrasjonen kjøres to ganger.
- Den avsluttede nedbetalingsavtalen i produksjon røres ikke. Et nytt, eldre brev på den lagres som historikk uten å endre status, utfall, stadium eller beløp (testet).
- Etter migrasjonen kan et eldre brev ikke lenger overskrive sakens tall uten at brukeren velger det. Det er den tilsiktede endringen.

## 4. RLS og tilgang

- `lagringsforsok`: RLS på. Brukeren kan lese og legge inn egne rader (`bruker_id = auth.uid()`). `update`, `delete` og `truncate` er trukket fra authenticated, og anon har ingen tilgang. Innsetting skjer i praksis bare via `lagre_brev` (security invoker).
- `kvoter` og `kvotebruk`: RLS på, ingen policyer, all tilgang trukket fra anon og authenticated. Bare service_role (serveren) kan lese og skrive.
- `reserver_kvote` og `fullfor_kvote` kan bare kjøres av service_role. En bruker kan altså ikke kalle `fullfor_kvote(…, false)` for å frigi sin egen kvote etter et vellykket kall.
- Serveren bruker service_role-klienten (`createAdminClient`) bare til kvotekallene, og bare etter at innloggingen er sjekket med brukerens egen sesjon.

## 5. Samspill med 0026, 0027 og 0028

- **Krever 0027:** `brev_statusovergang` brukes av `lagre_brev`. Migrasjonen stopper med `MEDHOLD_0029: kjør 0027 før 0029` hvis 0027 mangler, uten å endre noe.
- **0028:** ingen avhengighet i SQL, men 0028 skal kjøres før, slik at fristreglene gjelder når ny kode lagrer.
- **0026:** uendret. Ingen kolonner i `frister`/`saker` endres.
- `lagre_brev` fra 0027 erstattes helt. Statusregelen, låsingen av saken, kontrollen av `forventet_sist_endret`, erstatningen av frister og rekkefølgen av innsettinger er identiske. De eksisterende testene for 0027/0028 kjører uendret.

## 6. Feil under migrering

- Hele fila er én transaksjon (`begin … commit`). Feiler noe, rulles alt tilbake: ingen tabeller, ingen nye funksjoner, og `lagre_brev` står som før. Testet med en bevisst konflikt midt i fila.
- Fila er trygg å kjøre flere ganger (`if not exists`, `create or replace`, `drop policy if exists`, `on conflict do nothing`).
- Kontroll før og etter: `supabase/kontroll/for_0029.sql` er én skrivefri SELECT mot systemkatalogene og viser ingen persondata. Kolonnen «forventet» sier hva som er riktig.

## 7. Deployrekkefølge

Først testprosjektet, så produksjon, og bare med godkjenning for hvert steg.

**Testprosjektet:**
1. Kjør `supabase/kontroll/for_0029.sql`. Seksjon 1 skal vise `finnes`.
2. Kjør `0029_lagring_og_kvoter.sql`.
3. Kjør `supabase/testmiljo/testkvoter.sql`. Det gir lave testgrenser med 10 minutters vindu.
4. Kjør kontrollen på nytt. Alt skal stemme med «forventet».
5. Deploy Preview og gjør funksjonstesten: lagre, lagre igjen, eldre brev, kvote nådd og innlogging.

**Produksjon:**
1. Kjør 0027 og 0028 (ikke kjørt i produksjon ennå).
2. Kjør kontrollen.
3. Kjør 0029.
4. Kjør kontrollen.
5. Deploy koden.

Ny kode må **ikke** deployes før 0029 er kjørt. Kvotene stopper AI-funksjonene hvis `reserver_kvote` mangler, og det er bevisst: AI-kall skal ikke gå ubegrenset. Innloggingen fortsetter å virke, men uten kvote.

## 8. Tilbakeføring

1. Rull tilbake koden i Vercel (forrige deploy) **først**.
2. Kjør `supabase/tilbakeforing/0029_tilbake.sql`. Den sletter de tre tabellene og de tre nye funksjonene.
3. Kjør `0027_lagre_brev_atomisk.sql` på nytt. Den gjenoppretter `lagre_brev` identisk med 0027 (testet med md5 av funksjonskoden).

Brev, saker og frister berøres ikke. Kvitteringer og kvotebruk går tapt, men de er bare driftsdata. Den gamle `lagre_brev` godtar kall fra ny kode, fordi ukjente felt ignoreres. Tilbakeføring av databasen alene gjør altså ikke lagringen ugyldig, men kvotene slutter å virke.

## 9. Kjente begrensninger

- Ekte parallelle transaksjoner kan ikke testes i PGlite, som har én tilkobling. Samtidighet er dekket av advisory-lås, primærnøkkel og at reservasjoner teller med en gang. Det er testet sekvensielt.
- `kvotebruk` og `lagringsforsok` vokser over tid. Radene er små. Opprydding (f.eks. rader eldre enn 90 dager) bør legges i cron senere.
- En reservasjon som aldri fullføres (serveren krasjer), slutter å telle etter 15 minutter.
- Samme innhold kan sendes på nytt gratis én gang innen en time. Deretter belastes det som vanlig.
- Innlogging med SMS går direkte fra nettleseren til Supabase og har bare Supabase sine egne grenser.
