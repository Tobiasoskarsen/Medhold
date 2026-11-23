# Kun logisk backup. Skriver aldri til databasen eller gjenoppretter noe.
[CmdletBinding(SupportsShouldProcess)]
param(
  [Parameter(Mandatory)]
  [ValidatePattern('^(db\.leernzbmuldegiggnjib\.supabase\.co|aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com)$')]
  [string]$DatabaseHost
)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Dette oppsettet krever Windows og NTFS-rettigheter.' }
$projectRef = 'leernzbmuldegiggnjib'
$pgBin = Join-Path $PSScriptRoot '../.env.pg-tools/bin'
foreach ($tool in @('pg_dump.exe','pg_restore.exe','psql.exe')) {
  if (-not (Test-Path -LiteralPath (Join-Path $pgBin $tool))) { throw "Mangler lokalt verktøy: $tool" }
}
if (-not $PSCmdlet.ShouldProcess("Medhold produksjon ($projectRef)", 'Les PostgreSQL og lag lokal logisk backup')) { return }

$backupFolder = Join-Path $env:LOCALAPPDATA ('Medhold/private-backups/' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ'))
New-Item -ItemType Directory -Path $backupFolder | Out-Null
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls $backupFolder /inheritance:r /grant:r "*${sid}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Kunne ikke sikre backupmappen. Ingen database er kontaktet.' }
$dumpFile = Join-Path $backupFolder 'database.dump'
$errorFile = Join-Path $backupFolder 'private-errors.log'
$names = @('PGHOST','PGPORT','PGUSER','PGDATABASE','PGPASSWORD','PGSSLMODE','PGCONNECT_TIMEOUT','PGOPTIONS')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name,'Process') }
$secret = Read-Host 'Databasepassord for Medhold-produksjon (ikke API-nøkkel)' -AsSecureString
$pointer = [IntPtr]::Zero
try {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  $env:PGHOST = $DatabaseHost
  $env:PGPORT = '5432' # Direkte eller SESSION pooler, aldri transaction/6543.
  $env:PGUSER = if ($DatabaseHost.StartsWith('db.')) { 'postgres' } else { "postgres.$projectRef" }
  $env:PGDATABASE = 'postgres'
  $env:PGSSLMODE = 'require'
  $env:PGCONNECT_TIMEOUT = '15'
  $env:PGOPTIONS = '-c default_transaction_read_only=on'
  & (Join-Path $pgBin 'psql.exe') -X --no-password -v ON_ERROR_STOP=1 -Atc 'select current_database(), current_user, current_setting(''transaction_read_only'');' 1> (Join-Path $backupFolder 'connection-check.txt') 2> $errorFile
  if ($LASTEXITCODE -ne 0) { throw "Forbindelsen feilet. Se privat logg i $backupFolder. Ingen migrasjon er kjørt." }
  & (Join-Path $pgBin 'pg_dump.exe') --no-password --format=custom --file=$dumpFile 2> $errorFile
  if ($LASTEXITCODE -ne 0) { throw "Backup feilet. Filen må ikke brukes som godkjent backup. Se $backupFolder." }
  & (Join-Path $pgBin 'pg_restore.exe') --list $dumpFile 1> (Join-Path $backupFolder 'archive-list.txt') 2>> $errorFile
  if ($LASTEXITCODE -ne 0) { throw 'Backupens innholdsfortegnelse kunne ikke leses.' }
  & (Join-Path $pgBin 'pg_restore.exe') --file=NUL $dumpFile 2>> $errorFile
  if ($LASTEXITCODE -ne 0) { throw 'Backupen kunne ikke leses fullstendig. Ikke godkjent.' }
  $metadata = [ordered]@{ project=$projectRef; createdUtc=[DateTime]::UtcNow.ToString('o'); format='pg_dump custom'; bytes=(Get-Item -LiteralPath $dumpFile).Length; sha256=(Get-FileHash -LiteralPath $dumpFile -Algorithm SHA256).Hash; archiveReadable=$true; restoreTested=$false; storageFilesIncluded=$false; encrypted=$false }
  $metadata | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $backupFolder 'manifest.json') -Encoding utf8
  Write-Host "Backup og lesekontroll ferdig: $backupFolder"
  Write-Host 'Filen er tilgangsbegrenset, men ikke kryptert. Ikke last den opp til GitHub eller chat.'
  Write-Host 'Lesekontroll er ikke en gjenopprettingsprøve. Storage-filer og prosjektinnstillinger er ikke med.'
} finally {
  foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name,$previous[$name],'Process') }
  if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
  $secret.Dispose()
}
