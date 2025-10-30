<# 
.SYNOPSIS
    MySpinBot - Local Secret & Certificate Provisioning (PowerShell)

.DESCRIPTION
    Generates BasicAuth credentials (via OpenSSL) and wildcard TLS certificates (via mkcert)
    for local Traefik-based HTTPS routing.

.PARAMETERS
    AUTH_USER : Optional username (default = "admin")
    AUTH_PASS : Optional password (default = "admin")
    DOMAIN    : Optional domain (default = "myspinbot.local")
    FORCE     : Overwrite existing files if "true"
#>

param(
    [string]$AUTH_USER = $env:AUTH_USER,
    [string]$AUTH_PASS = $env:AUTH_PASS,
    [string]$DOMAIN    = $env:DOMAIN,
    [string]$FORCE     = $env:FORCE
)

# Defaults
if (-not $AUTH_USER) { $AUTH_USER = 'admin' }
if (-not $AUTH_PASS) { $AUTH_PASS = 'admin' }
if (-not $DOMAIN)    { $DOMAIN    = 'myspinbot.local' }
if (-not $FORCE)     { $FORCE     = 'false' }

Write-Host '--- [MySpinBot] Provisioning local secrets and certificates ---'
Write-Host ('   -> Domain: {0}' -f $DOMAIN)
Write-Host ('   -> User:   {0}' -f $AUTH_USER)

# Paths
$RootDir    = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$SecretsDir = Join-Path $RootDir 'traefik\secrets'
$CertsDir   = Join-Path $RootDir 'traefik\certs'

New-Item -ItemType Directory -Force -Path $SecretsDir | Out-Null
New-Item -ItemType Directory -Force -Path $CertsDir   | Out-Null

# 1) Ensure OpenSSL and mkcert are available
if (-not (Get-Command openssl -ErrorAction SilentlyContinue)) {
    Write-Host '-> Installing OpenSSL via WinGet...'
    winget install ShiningLight.OpenSSL.Light --silent --accept-source-agreements | Out-Null
    # Add typical path for current session if needed
    if (-not (Get-Command openssl -ErrorAction SilentlyContinue)) {
        $osslPath = 'C:\Program Files\OpenSSL-Win64\bin'
        if (Test-Path $osslPath) { $env:Path += ';' + $osslPath }
    }
}

if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
    Write-Host '-> Installing mkcert via WinGet...'
    winget install FiloSottile.mkcert --silent --accept-source-agreements | Out-Null
}

# 2) Generate BasicAuth file using OpenSSL
$HtpasswdFile = Join-Path $SecretsDir 'htpasswd'

if (($FORCE -eq 'true') -or -not (Test-Path $HtpasswdFile)) {
    Write-Host '-> Generating BasicAuth credentials with OpenSSL...'
    try {
        $hash = (& openssl passwd -bcrypt $AUTH_PASS 2>$null)
        if (-not $hash) {
            Write-Host '   bcrypt not supported in this OpenSSL build; using apr1 instead...'
            $hash = (& openssl passwd -apr1 $AUTH_PASS).Trim()
        } else {
            $hash = $hash.Trim()
        }
        if (-not $hash) { throw 'OpenSSL failed to generate any hash.' }
        "${AUTH_USER}:$hash" | Out-File -Encoding ascii -NoNewline $HtpasswdFile
        Write-Host "   Created htpasswd file: $HtpasswdFile"
    }
    catch {
        Write-Error "[X] Failed to generate password hash: $_"
        exit 1
    }
} else {
    Write-Host '-> htpasswd already exists (use FORCE=true to regenerate).'
}

# 3) Generate local wildcard certificate with mkcert
$Crt = Join-Path $CertsDir ('wildcard-{0}.crt' -f $DOMAIN)
$Key = Join-Path $CertsDir ('wildcard-{0}.key' -f $DOMAIN)

if (($FORCE -eq 'true') -or -not (Test-Path $Crt) -or -not (Test-Path $Key)) {
    Write-Host ('-> Generating wildcard certificate for *.{0} ...' -f $DOMAIN)
    & mkcert -install | Out-Null
    & mkcert -cert-file $Crt -key-file $Key ('*.{0}' -f $DOMAIN)
    Write-Host '   Certificate created:'
    Write-Host ('     {0}' -f $Crt)
    Write-Host ('     {0}' -f $Key)
} else {
    Write-Host '-> Certificates already exist (use FORCE=true to regenerate).'
}

# 4) Permissions
try {
    icacls $SecretsDir /inheritance:r /grant:r "$($env:USERNAME):(R)" | Out-Null
    icacls $CertsDir   /inheritance:r /grant:r "$($env:USERNAME):(R)" | Out-Null
} catch {
    Write-Host '(!) Unable to adjust file permissions (non-critical).'
}

Write-Host '✅ [MySpinBot] Local provisioning complete.'
Write-Host ('   Secrets directory: {0}' -f $SecretsDir)
Write-Host ('   Certificates:      {0}' -f $CertsDir)
