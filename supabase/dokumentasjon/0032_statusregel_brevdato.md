# Migrasjon 0032: statusregelen når et brev legges til

Fil: `supabase/migrations/0032_statusregel_brevdato.sql`. Del C av
`MEDHOLD_FUNN_OG_TONE_ARBEIDSORDRE.md`.

**Kjøres bare i testprosjektet** («medhold test») til release-porten i
`docs/testing/R3_RELEASE_GATE.md` er passert. Ikke kjørt noe sted ennå;
testet lokalt mot Postgres (PGlite).

## Hvorfor

I Nordkapp-saken ble svaret registrert som sendt 11. november, og det samme
brevet fra 2. november ble lagt inn på nytt. Brevet hadde en frist fram i tid,
så `lagre_brev` satte saken tilbake fra `venter_pa_svar` til `aktiv`. Saken så
ut som om den trengte handling, selv om svaret var sendt.

## Ny regel

En sak i `venter_pa_svar` går bare til `aktiv` når alt dette gjelder:

1. Brevet har en frist fra i dag eller senere. Dette er regelen fra før.
2. Brevdatoen er nyere enn alle andre brev i saken (`brev_datovurdering` gir
   `nyest`), eller ukjent (`mangler`).
3. Brevdatoen er etter dagen et utkast i saken sist ble markert som sendt
   (`max(sendt_at)` i norsk tid). Når brevdatoen er ukjent, gjelder ikke
   denne betingelsen.

Ellers fortsetter saken å vente. Reglene for avslutning, gjenåpning og utfall
er uendret: `brev_statusovergang` er ikke rørt. Den nye betingelsen sendes inn
som `kommende_frist`, som funksjonen bare bruker for overgangen fra venter
til aktiv.

Samme regel i appen: `statusVedNyttBrev` i `src/lib/utfall.ts` med inputene
`datovurdering`, `brevdato` og `sistSendt`. Forhåndsvisningen i brevflyten
bruker den. `supabase/tests/statusregel.test.mjs` kjører hele `lagre_brev`
for 54 kombinasjoner av brevdato, frist og sendtdato, og krever samme status
som appen.

## Objekter

| Objekt | Endring |
|---|---|
| `public.lagre_brev(jsonb)` | Erstattes. Kroppen er 0029 sin, med to endringer: datovurderingen regnes ut før statusovergangen, og `v_sist_sendt` hentes fra `utkast` og brukes i betingelsen. |

Ingen nye tabeller, kolonner, indekser, constraints eller rettigheter. Grants
og revokes er de samme som i 0029: authenticated kan kjøre, ikke public eller
anon.

## Påvirkning på data

Endrer ingen eksisterende rader. Bare nye lagringer følger den nye regelen.
Duplikatet i Nordkapp-saken rettes ikke av migrasjonen; Tobias sletter det
selv i test.

## RLS og tilgang

Funksjonen er fortsatt `security invoker`. Oppslaget i `utkast` filtreres på
sak og bruker og går gjennom RLS som brukeren selv.

## Samspill med 0026–0031

- **Krever 0029** (`brev_datovurdering`, `lagringsforsok`). Mangler den,
  stopper 0032 med `MEDHOLD_0032: kjør 0029 før 0032` uten å endre noe.
- **0027:** `brev_statusovergang` brukes uendret.
- **0030/0031:** `registrer_utkast_sendt` setter `sendt_at`, som 0032 leser.
  Den rører ikke `lagre_brev`.

## Feil under migreringen

Hele fila er én transaksjon. Feiler noe, rulles alt tilbake, og `lagre_brev`
står som i 0029. Fila tåler å kjøres flere ganger (`create or replace`).

Skrivefri kontroll før og etter: `supabase/kontroll/for_0032.sql`. Den viser
versjonen av `lagre_brev` (`0029` før, `0032` etter), rettighetene og antall
ventende saker, som ikke skal endres.

## Rekkefølge

**Testprosjektet:**
1. Kjør `for_0032.sql`. Seksjon 1 skal vise «finnes», og versjonen skal være `0029`.
2. Kjør `0032_statusregel_brevdato.sql`.
3. Kjør `for_0032.sql` igjen. Alt skal stemme med «forventet».
4. Deploy Preview og test: legg samme brev inn på nytt i en sak som venter
   på svar, så skal saken fortsatt vente.

**Produksjon:** Bare etter release-porten, og etter 0024–0031 slik porten
beskriver. Migrasjonen kjøres før koden. Ny kode virker også mot 0029, men
forhåndsvisningen viser da en regel databasen ikke bruker ennå.

## Tilbakeføring

Kjør `supabase/tilbakeforing/0032_tilbake.sql`. Den setter `lagre_brev`
tilbake nøyaktig slik den var i 0029 (testet med md5 av funksjonskoden) med
samme rettigheter. Ingen data går tapt. Rull helst også tilbake koden, så
forhåndsvisningen stemmer med databasen.
