# R6 – siste justeringer til PR #69

11. november 2026. Denne kontrollen supplerer [opprinnelig R6-rapport](RAPPORT.md).

## Gjennomført

- Registrert frist kommer før ventestatus/påminnelse på saksoversikten. Hjem viser den ventende toppsakens frist, valgt med eksisterende `relevantFrist` fra allerede hentede data. Dette påvirker ikke rangering av saker, fristberegning eller varslingsgrunnlag. Registrert frist vises tydelig; oppfølgingsteksten er sekundær og presiserer at den ikke endrer brevets frist. Ingen ny frist konstrueres når data mangler.
- Global plussinngang har synlig «Legg til» og fortsatt tilgjengelig navn «Legg til brev». Minst 44 px trykkflate. Menyens høyde er nå minimumshøyde, slik at den kan vokse med innholdet. Sakens «Legg til svarbrev» beholder sakskontekst; Hjems svarbrevinngang bruker samme eksisterende `/legg-til-brev?krav=…` som saksoversikten. Generell inngang er fortsatt `/legg-til-brev`.
- Registrert sendt bruker eksisterende `bg-mint text-mint-tekst` uten gjennomsiktighet: **9,42:1 i lys** og **11,01:1 i mørk**. Begge over 3:1. Kontrasttesten leser faktisk CSS-tokenverdi for begge temaer.
- Dokumentnavn er tittel også i historikken. Status er egen undertekst: «Utkast – ikke registrert sendt» / «Registrert sendt», basert på eksisterende `sendt_at`. Ingen endrede data, lenker, hendelser eller «Levert»-påstand.
- Rapportens «Ingen deploy» er presisert til «Ingen produksjonsdeploy». Vercel-preview er forventet ved push.

## Utførte kontroller

- `npm test`: **404/404**.
- `npm run test:db`: **147/147**, inklusive nye regresjonstester for Hjems frist/oppfølging, historikkstatus og lys/mørk-kontrast. Testharness gjennomgår nå også historikkens `forhand`-innhold; ingen kontroller svekket.
- TypeScript bestått. Produksjonsbygg bestått, med TypeScript inkludert.
- Full lint: ingen feil eller nye kodeadvarsler. En eksisterende advarsel i ignorert lokal `.env.release-guard`-kopi av GoogleKnapp står igjen. To advarsler i egen midlertidig redigeringsfil ble ryddet bort før sluttkjøringen; ingen nye undertrykkelser.
- Faktisk IAB-nettleser med disponibel syntetisk konto i bekreftet testprosjekt. Meny ved 320 px uten horisontal overflow, synlig label og tilgjengelig navn kontrollert. Utkastets tekstfelt fikk fokus; navigasjonen fikk opacity 0 som forventet. Dette er fokus-test på desktop, ikke bevis på fysisk mobiltastatur.
- Frist før påminnelse på Hjem/sak, separate tekster, riktige sakskoblinger, dokumentfanen og historikkens status kontrollert. Lys/mørk status kontrollert visuelt og semantisk. Ved ferdig scroll var siste handlings bunn ca. 727 px og menyens topp 770 px; handlingen kan komme helt over menyen.
- Disponibel konto og tilhørende syntetiske data ryddet. Ingen produksjonsdata eller ekte utsending.

## Oppdaterte bilder

- [Bunnmeny ved 320 px](justering/meny-320.png).
- Hjem: [lys](justering/frist-hjem-lys.png), [mørk](justering/frist-hjem-mork.png).
- Saksoversikt: [lys](justering/frist-oversikt-lys.png), [mørk](justering/frist-oversikt-mork.png).
- Registrert sendt og ny meny: [lys](justering/sendt-lys.png), [mørk](justering/sendt-mork.png).
- [Historikk med egen dokumentstatus](justering/historikk-status.png).

Faktiske nettleserbilder med syntetiske data. Fullsidebilder viser fixed-menyen ved viewportposisjonen; bruk målingen og statusbildene for å vurdere ferdig scrolling. Utviklerindikator kan vises.

## Gjenstående kontroll – ikke påstått gjennomført

Agenten har ingen tilkoblet fysisk iPhone/Android eller VoiceOver. Tidligere brukerbekreftelser fra eldre versjoner regnes ikke som nye R6-testbevis.

- Fysisk mobil: tastatur, bunnmeny, safe area og faste handlinger sammen.
- Stor tekst / reell 200 % zoom på Hjem, Saker, Oversikt/Dokumenter/Historikk, Meg og brevkontroll. 320 px viewport er ikke det samme som 200 % zoom.
- VoiceOver: «Hjem», «Saker», «Legg til brev», «Meg», valgt tilstand, utvidbare detaljer og opplest dokumentstatus.

Ingen av disse punktene er markert som bestått. Koden og PR-en er oppdatert for gjennomgang, men arbeidsordrens fulle fysiske tilgjengelighetskontroll gjenstår. Ingen nye pakker, backend-/databaseendringer, beregninger, lagring eller sending. **Ingen merge eller produksjonsdeploy.**
