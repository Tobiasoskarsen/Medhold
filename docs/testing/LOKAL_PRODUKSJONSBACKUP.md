# Lokal PostgreSQL-backup – klargjort 10. november 2026

Kun oppsett og tørrkjøring er utført. Ingen produksjonsbackup er tatt ennå.
Ingen migrasjoner/deploy følger av å kjøre skriptet.

PostgreSQLs offisielle Windows-side henviser til EDBs binærarkiv. PostgreSQL
17.11 er hentet fra https://sbp.enterprisedb.com/getfile.jsp?fileid=1260616,
lenket fra https://www.enterprisedb.com/download-postgresql-binaries.
Kun pg_dump, pg_restore, psql og DLL-er er pakket ut i .env.pg-tools/bin.
Verktøyversjoner er kontrollert; ingen databaseserver/tjeneste er installert.
Mappen er Git-ignorert. Ingen avhengigheter i appen er endret.

Kjør i PowerShell 7 fra repoet:

    ./scripts/backup-production.ps1 -DatabaseHost aws-1-eu-central-1.pooler.supabase.com

Host, port 5432 og bruker postgres.leernzbmuldegiggnjib er kontrollert i
produksjonsprosjektets Connect → Direct → Session pooler. Passordet tastes
skjult lokalt med Read-Host -AsSecureString, ikke i argumenter eller chat.
API-/service-role-nøkler er ikke PostgreSQL-passord.

Skriptet bruker TLS og read-only transaksjonsinnstilling, tar custom-format
pg_dump, kontrollerer pg_restore-listen og at hele arkivet kan leses, og
lager SHA-256-manifest. Det gjenoppretter aldri noe og skriver aldri SQL til
produksjonen. Tidligere PG-miljøvariabler gjenopprettes i finally.

Filene lagres utenfor repoet under LOCALAPPDATA/Medhold/private-backups med
NTFS-tilgang begrenset til Windows-brukeren og SYSTEM. De er **ikke kryptert**.
Logg, dump og innholdsfortegnelse kan inneholde sensitive data. Ikke legg dem
i Git, chat, GitHub-artifacts eller skylagring uten egen vurdering.

En lesbar dump er ikke bevis på vellykket restore. Isolert restore-prøve
gjenstår før backupen kan brukes som fullført gjenopprettingsbevis. Supabase
Storage-filer og prosjektinnstillinger følger ikke med i PostgreSQL-dumpen.
Migrasjoner holdes igjen til backup og nødvendig gjenopprettingsgrunnlag er
kontrollert. Verktøyoppsettet i seg selv godkjenner ingen produksjonsendring.

Kilder:
https://www.postgresql.org/download/windows/
https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

Validering: PowerShell-parser uten feil, -WhatIf uten databasekontakt,
verktøyversjoner 17.11, og git check-ignore for binærarkiv/verktøy. Faktisk
databaseforbindelse, eksport og restore er foreløpig utestet.
