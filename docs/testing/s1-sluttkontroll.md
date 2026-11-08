# S1 – sluttkontroll 8. november 2026

Ingen merge, manuell deploy, Supabase-migrasjon eller endring av reelle brukerdata er gjort i denne implementeringen. PR-ene er stablet: A → B → C → D → E → F.

## Resultat per pakke

| Pakke | PR / commit | Rettelse og kontroll |
|---|---|---|
| A | #54 / e912e41 | Negasjons- og påstandsvakt; 31 nye regresjoner, blant annet negasjon, delbetaling, usikkerhet og regenerering. |
| B | #55 / 90aaea8 | Streng norsk beløpsgrense på klient og server; faktisk action testet med databaseadapter. Ugyldig beløp gir ingen INSERT. |
| C | #56 / 514a4be | Eksplisitt lagring, versjonskonflikt, gjenåpning, autoritativ slutttekst og bevart sendt-versjon. Krever 0030 før kodeutrulling. |
| D | #57 / 9a6220d | Forklaring bygges fra dokumentfeltene, ikke oppdiktet historikk/prosess. Fire syntetiske modelltester er lagret i s1-d-modellrapport.json. |
| E | #58 / 3235747 | Synlig støtteomfang og begrensninger, ingen nye juridiske regler. Se s1-e-stotteomfang.md. |
| F | egen PR | Øreberegning, lokal søking på saksnummer, historikk uavhengig av avsluttet status og lesbare fristtitler. Kvotetekst peker til saken og skiller sendt fra redigerbart utkast. |

## Praktisk lokal nettlesertest

Testene brukte kopier av de faktiske klientkomponentene, med kun transport/import til analyse- og lagringsadapter byttet ut. Dummy Supabase-adresse hindret tilgang til ekte backend. De midlertidige rutene ble fjernet etter testen.

- **C:** Redigering viser ulagret status og sperrer kopier/e-post/sendt. Vellykket lokal lagring gir lagret status; refresh viste samme redigerte tekst. Simulert lagringsfeil bevarte teksten og viste feil. To faner med samme startversjon: første lagret, andre fikk versjonskonflikt og beholdt sin tekst. Dette er klienttest med lokal adapter, ikke bevis på produksjonssamtidighet.
- **D:** Full kontrollflyt med syntetisk analyse som bevisst inneholdt feil forklaring om arrest/varer: kun ny faktasammendrag ble vist. Retting fra 1288 til 289 oppdaterte sammendraget og viste sumavvik 1288 mot 289. Funnene var skjult før bekreftelse.
- **E:** Bekreftet namsmannsbrev viste både «Innenfor beløpsgrensen», forbehold om samlet kostnadsdekning og at juridisk frist ikke er kontrollert. Detaljer kunne åpnes.
- **F:** Saksnummersøk 88213 åpnet riktig gruppe og viste FK-2026-88213. Fristtittel ble kontrollert på 320, 390, 430 og 1280 px uten horisontal overflow. Mørk 320 px-visning ble visuelt kontrollert. Simulert clipboard-feil viste «Kunne ikke kopiere …» uten falsk suksess.

Siste UI-gjennomgang avdekket også at ferdig-tekstfeltet måtte være skrivebeskyttet under lagring og for registrert sendt tekst. Dette er rettet i F; lagret omfang gjenopprettes fra vaktfakta. En gjenværende absolutt kostnadsgaranti i betalingsmerknaden er fjernet.

## Automatiske kontroller

- F-regresjonen feilet før rettelsen: avdrag summerte til 10120 i stedet for 10119,50.
- Etter rettelsen: 17 måneder à 600 kr med siste avdrag 519,50; summen kontrolleres i heltallsøre. Også desimalt månedsbeløp og total under 1 kr er dekket.
- 389 enhetstester og 73 lokale databasetester grønne.
- Lint, typekontroll og produksjonsbygg er grønne på samlet gren. Bygget varsler om flere lockfiler i worktree-oppsettet; ingen kodefeil eller testsvikt.

## Begrensninger og utrulling

- C-migrasjonen er bare testet lokalt med PGlite, inkludert RLS, versjon, sendt-snapshot og atomisk status. Separat Supabase-testdatabase med ekte PostgREST, eksisterende data og parallelle forbindelser gjenstår. Følg supabase/dokumentasjon/0030_utkast_versjoner.md; ingen kodeutrulling før migrasjonen er godkjent og finnes.
- Modellmålingen bruker fire syntetiske tekster og én måling per tekst. Den er ikke et fullstendig fasitsett eller garanti for AI-lesing.
- Fysisk iPhone/Safari, Android Chrome, kamera, HEIC, skjermleser og stor systemtekst er ikke verifisert her. Viewportkontroll er ikke fysisk enhetstest. OS-styrt reduced motion og avbrutt nettverk i full produksjonsflyt gjenstår.
- Søk er lokalt i eksisterende grupperte data, uten ekstern indeks. Treff på saksnummer viser hele kreditorkonteksten. Fakturanummer finnes ikke som eget strukturert felt i dagens listegrunnlag; det er ikke oppfunnet en ny indeks. Flate lister har fortsatt ikke et nytt søkefelt.
- Historiske funn bestemmes nå av brevets alder også på avsluttede/ventende saker. Kortet som ber om nyere brev vises fortsatt bare ved aktiv sak. Ingen fristregel endret.
- Eksisterende npm-audit-funn er ikke endret som del av S1. Ingen nye avhengigheter.

## Endrede filer

Eksakt liste per pakke finnes i PR-diffen. C berører utkast/actions, utkast/page, UtkastFlyt, strøm-ruten og saksdetalj, samt 0030, oppsett.sql og utkast-versjon.test.mjs. D berører brevanalyse, brevforklaring, opplastingsactions/flyt, format.test og modellskript/rapport. E berører kontrollomfang, Gebyrsjekk, kontrollflyt, saks-/brevdetalj og VeierUtFlyt. F berører avdrag og tester, kvote og tester, GruppertSaksliste, Kravkort, saksliste/-detalj, FristRad, VeierUtFlyt og UtkastFlyt. Alle pakkene oppdaterer PROSJEKT_STATUS.md.
