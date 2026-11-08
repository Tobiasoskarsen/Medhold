# S1-E: faktisk kontrollomfang

Dette er en inventarliste over kode, ikke en ny juridisk vurdering. Ingen regler eller terskler er lagt til.

| Dokumenttype | Datouttrekk | Gebyrbeløp | Fristregel | Alvorlighet | Ikke kontrollert / nødvendig grunnlag |
|---|---|---|---|---|---|
| Faktura / purring | AI-uttrekk, brukeren bekrefter | Støttede kostnadstyper, datogyldige satser | Ingen særskilt juridisk sammenligning | Begrenset tekstsignal, se under | Total kravgyldighet, forfallsvilkår og samlet kostnadsdekning. Kontroller originalen. |
| Inkassovarsel | Samme | Samme | Eksisterende regel i gjeld.ts / frist.ts | Samme | Dokumentasjon av utsendelse, mottak, betalingshistorikk og lovlige vilkår vurderes ikke fullt ut. |
| Betalingsoppfordring | Samme | Samme | Eksisterende regel i gjeld.ts / frist.ts | Samme | Samme begrensninger; salær avhenger også av hovedstol og satskategori. |
| Forliksråd / namsmann | Samme | Kun støttede beløp, ikke rettsgebyr | Ingen juridisk fristkontroll for disse typene | Samme, ingen generell utleggs-/tvangsfullbyrdelseskontroll | Rettslig grunnlag og konkret frist krever faglig vurdering og originaldokumenter. Ingen generell 14-dagersregel lagt til. |
| Nedbetaling / avsluttet / annet | Samme | Kun støttede beløp | Ingen særskilt juridisk fristkontroll | Samme | Avtalestatus, etterlevelse og kravets endelige oppgjør bekreftes ikke av appen. |

Kilder i repo: src/lib/gjeld.ts (FRIST_HJEMMEL), frist.ts, gebyr.ts, alvorsgrense.ts og brevanalyse.ts. Gebyrmotoren sammenligner purre-/varsel-/betalingsoppfordringsgebyr og salær med tilgjengelige satser. Renter, rettsgebyr og annet er ukjent. Samlet kostnadsdekning er ikke kontrollert.

Alvorlighetskontrollen er eksisterende frasesøk etter konkurs- og tvangssalgssignaler; den er ikke en fullstendig vurdering av rettslige stadier. Fravær av treff innebærer ikke trygg sak.

Testbrev 43: gebyrer må ikke forstås som godkjent samlet selv om enkeltbeløp er innenfor grensen. Testbrev 44: registrert namsmannsstadium og uttrukket dato betyr ikke kontrollert juridisk frist. UI viser uttrykkelig denne begrensningen.

## Nye tekster til advokatgjennomgang

- Vi har ikke kontrollert om disse kostnadene kan kreves samlet.
- Medhold har ikke kontrollert den juridiske fristen for denne brevtypen.
- Fristkontrollen gjelder bare støttede brevtyper og registrerte datoer. Den avgjør ikke om kravet er gyldig.
- Medhold bekrefter ikke at betaling fjerner alle kostnader eller hindrer en betalingsanmerkning.
- Kreditor må godta forespørselen; renter og kostnader kan fortsatt endre beløpet.
