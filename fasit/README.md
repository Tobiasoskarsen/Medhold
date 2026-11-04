# Fasitsettet

Måler om Medhold leser brev og skriver utkast riktig (MEDHOLD_SIKKERHET_ARBEIDSORDRE Del E).

```
fasit/
  brev/                 testbrev_1.pdf … testbrev_31.pdf (legges inn for hånd, se under)
  forventet/NN.json     ett per brev, fylt ut for hånd fra PDF-ens tekstlag
  utkast/scenarioer.json  20 utkastscenarioer
  rapport.md            generert av skriptene under, committes
```

## Regler for `forventet/NN.json`

- Verdiene skrives inn for hånd ved å lese PDF-en (f.eks. `pdftotext -layout brev/testbrev_NN.pdf -`).
- **Utled aldri noe med appens egen kode.** Da tester appen seg selv.
- `verifisert: true` settes først når en person har sjekket filen mot PDF-en.

Felter:

| Felt | Innhold |
|---|---|
| `brev` | filnavnet i `brev/` |
| `brevtype` | `faktura`, `purring`, `inkassovarsel`, `betalingsoppfordring`, `forliksrad`, `namsmann`, `nedbetaling`, `avsluttet` eller `annet` |
| `brevdato` | ISO-dato eller `null` |
| `belop` | «Å betale» i kroner |
| `hovedstol` | kroner eller `null` |
| `kostnadslinjer` | `[{ "type": Kostnadstype, "belop": kr }]` i brevets rekkefølge |
| `fristIBrevet` | brevets egen betalingsfrist (ISO) eller `null` |
| `saksnummer`, `avsender` | som i brevet, eller `null` |
| `forventetGebyrsjekk` | vurdering per kostnadslinje: `innenfor`, `mulig_over`, `over` eller `ukjent` |
| `forventetFristfunn` | `samstemmer`, `avvik_kortere`, `avvik_lengre`, `kun_eksplisitt`, `kun_beregnet` eller `null` |
| `forventetSum` | `stemmer`, `avvik` eller `ukjent` |

`forventet*`-feltene er det en jurist ville sagt, ikke det appen sier. Er de uenige, er det
appen som har en regelfeil.

## Kjøring

- `npm test` kjører `src/lib/fasit.test.ts`: reglene (gebyrsjekk, frist, sum) på de riktige feltene.
- `node --env-file=.env.local scripts/fasit-lesing.ts`: AI-lesingen av hver PDF mot fasit.
- `node --env-file=.env.local scripts/fasit-utkast.ts`: utkast for hvert scenario, med vaktene.

Begge skriptene skriver sin del av `rapport.md`.
