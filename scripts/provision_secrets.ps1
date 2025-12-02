<#
.SYNOPSIS
    MySpinBot - Local Secrets, Certificates & Authentication Provisioning (PowerShell)

.DESCRIPTION
    Prepares the local development environment for MySpinBot by generating:
      • BasicAuth credentials (via OpenSSL) for Traefik-protected services
      • Wildcard TLS certificates (via mkcert) for local HTTPS routing
      • Infrastructure facilities credentials synchronized with Traefik BasicAuth

    The script ensures all secret directories exist, installs dependencies (OpenSSL & mkcert) if missing,
    and keeps all generated files outside of version control under the /secrets directory.

.PARAMETERS
    AUTH_USER : Optional username for authentication (default = "admin")
    AUTH_PASS : Optional password for authentication (default = "password")
    DOMAIN    : Optional local domain for certificates (default = "myspinbot.local")
    DB_NAME   : Optional name for root database (default = "myspinbot")
    FORCE     : Overwrite existing files if "true"

.NOTES
    All sensitive files (htpasswd, root.env, certs) are generated in the secrets/ directory
    and should remain untracked by git.
#>

param(
    [string]$AUTH_USER = $env:AUTH_USER,
    [string]$AUTH_PASS = $env:AUTH_PASS,
    [string]$DOMAIN = $env:DOMAIN,
    [string]$DB_NAME = $env:DB_NAME,
    [string]$FORCE = $env:FORCE
)

# Defaults
if (-not $AUTH_USER) { $AUTH_USER = 'admin' }
if (-not $AUTH_PASS) { $AUTH_PASS = 'password' }
if (-not $DOMAIN) { $DOMAIN = 'myspinbot.local' }
if (-not $DB_NAME) { $DB_NAME = 'myspinbot' }
if (-not $FORCE) { $FORCE = 'false' }

Write-Host '--- [MySpinBot] Provisioning local secrets and certificates ---'
Write-Host ('   -> Domain: {0}' -f $DOMAIN)
Write-Host ('   -> User:   {0}' -f $AUTH_USER)
Write-Host ('   -> Database:   {0}' -f $DB_NAME)

# Paths
$RootDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$InfraDir = Join-Path $RootDir 'infra'
$SecretsDir = Join-Path $InfraDir 'traefik\secrets'
$CertsDir = Join-Path $InfraDir 'traefik\certs'

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
        }
        else {
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
}
else {
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
}
else {
    Write-Host '-> Certificates already exist (use FORCE=true to regenerate).'
}

# 4) Permissions
try {
    icacls $SecretsDir /inheritance:e /grant "$($env:USERNAME):(F)" /T | Out-Null
    icacls $CertsDir   /inheritance:e /grant "$($env:USERNAME):(F)" /T | Out-Null
}
catch {
    Write-Host '(!) Unable to adjust file permissions (non-critical).'
}


# 5) Provision facilities foundational configs

$RootEnv = Join-Path $RootDir '.env'

if (($FORCE -eq 'true') -or -not (Test-Path $RootDir)) {
    Write-Host '-> Generating root .env ...'
    try {
        $content = @()
        $content += "PROJECT_DOMAIN=$DOMAIN"
        Set-Content -Path $RootEnv -Value $content -Encoding Ascii
        Write-Host ("   Created root .env: {0}" -f $RootEnv)
    }
    catch {
        Write-Error "[X] Failed to write to .env: $_"
        exit 1
    }
}
else {
    Write-Host '-> Root .env already exists (use FORCE=true to regenerate).'
}

$GrafanaDir = Join-Path $InfraDir 'grafana\secrets'
$GrafanaEnv = Join-Path $GrafanaDir 'root.env'
$GrafanaURL = "grafana.$DOMAIN"

New-Item -ItemType Directory -Force -Path $GrafanaDir | Out-Null

if (($FORCE -eq 'true') -or -not (Test-Path $GrafanaDir)) {
    Write-Host '-> Generating Grafana root.env (synchronized with Traefik BasicAuth)...'
    try {
        # Same credentials as Traefik BasicAuth
        $content = @()
        $content += "GF_SECURITY_ADMIN_USER=$AUTH_USER"
        $content += "GF_SECURITY_ADMIN_PASSWORD=$AUTH_PASS"
        $content += "GF_SERVER_DOMAIN=$GrafanaURL"
        Set-Content -Path $GrafanaEnv -Value $content -Encoding Ascii
        Write-Host ("   Created Grafana root.env: {0}" -f $GrafanaEnv)
    }
    catch {
        Write-Error "[X] Failed to write Grafana credentials: $_"
        exit 1
    }
}
else {
    Write-Host '-> Grafana root.env already exists (use FORCE=true to regenerate).'
}

$MinioDir = Join-Path $InfraDir 'minio\secrets'
$MinioEnv = Join-Path $MinioDir 'root.env'
$MinioURL = "s3.$DOMAIN"

New-Item -ItemType Directory -Force -Path $MinioDir | Out-Null

if (($FORCE -eq 'true') -or -not (Test-Path $MinioEnv)) {
    Write-Host '-> Generating MinIO root.env (synchronized with Traefik BasicAuth)...'
    try {
        # Same credentials as Traefik BasicAuth
        $content = @()
        $content += "MINIO_ROOT_USER=$AUTH_USER"
        $content += "MINIO_ROOT_PASSWORD=$AUTH_PASS"
        $content += "MINIO_ACCESS_KEY=$AUTH_USER"
        $content += "MINIO_SECRET_KEY=$AUTH_PASS"
        Set-Content -Path $MinioEnv -Value $content -Encoding Ascii
        Write-Host ("   Created MinIO root.env: {0}" -f $MinioEnv)
    }
    catch {
        Write-Error "[X] Failed to write MinIO credentials: $_"
        exit 1
    }
}
else {
    Write-Host '-> MinIO root.env already exists (use FORCE=true to regenerate).'
}

$PgDir = Join-Path $InfraDir 'postgres\secrets'
$PgEnv = Join-Path $PgDir 'root.env'
$pgAdminURL = "pgadmin.$DOMAIN"

$POSTGRES_USER = $AUTH_USER
$POSTGRES_PASSWORD = $AUTH_PASS
$POSTGRES_DB = $DB_NAME

New-Item -ItemType Directory -Force -Path $PgDir | Out-Null

if (($FORCE -eq 'true') -or -not (Test-Path $PgEnv)) {
    Write-Host '-> Generating PostgreSQL root.env (synchronized with Traefik BasicAuth)...'
    try {
        # Same credentials as Traefik BasicAuth
        $content = @()
        $content += "POSTGRES_USER=$POSTGRES_USER"
        $content += "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
        $content += "PGADMIN_DEFAULT_EMAIL=${AUTH_USER}@$DOMAIN"
        $content += "PGADMIN_DEFAULT_PASSWORD=$AUTH_PASS"
        $content += "POSTGRES_DB=$POSTGRES_DB"
        Set-Content -Path $PgEnv -Value $content -Encoding Ascii
        Write-Host ("   Created PostgreSQL root.env: {0}" -f $PgEnv)
    }
    catch {
        Write-Error "[X] Failed to write PostgreSQL credentials: $_"
        exit 1
    }
}
else {
    Write-Host '-> PostgreSQL root.env already exists (use FORCE=true to regenerate).'
}

$PgAdminDir = Join-Path $InfraDir 'postgres\pgadmin'
$PgAdminServersTemplateFile = Join-Path $PgAdminDir 'servers.json.template'
$PgAdminServersFile = Join-Path $PgAdminDir 'servers.json'

if (($FORCE -eq 'true') -or -not (Test-Path $PgAdminServersTemplateFile)) {
    Write-Host '-> Generating PgAdmin servers.json ...'
    try {
        $template = Get-Content -Raw -Path $PgAdminServersTemplateFile
        $regex = [regex]'\$\{([A-Za-z_][A-Za-z0-9_]*)\}'
        $expanded = $regex.Replace($template, {
                param($match)
                $varName = $match.Groups[1].Value
                $value = Get-Variable -Name $varName -ErrorAction SilentlyContinue
                if ($value) {
                    return $value.Value
                }
                else {
                    throw "Variable `${varName} is not defined in the script."
                }
            })
        $expanded | Set-Content -Path $PgAdminServersFile
        Write-Host ("   Created PgAdmin servers.json: {0}" -f $PgAdminServersFile)
    }
    catch {
        Write-Error "[X] Failed to write PostgreSQL credentials: $_"
        exit 1
    }
}
else {
    Write-Host '-> PgAdmin servers.json already exists (use FORCE=true to regenerate).'
}

$ApiDir = Join-Path $RootDir 'backend\secrets'
$ApiEnv = Join-Path $ApiDir 'root.env'
$ApiURL = "api.$DOMAIN"

New-Item -ItemType Directory -Force -Path $ApiDir | Out-Null

if (($FORCE -eq 'true') -or -not (Test-Path $ApiDir)) {
    Write-Host '-> Generating Backend root.env (synchronized with Traefik BasicAuth)...'
    try {
        # Same credentials as Traefik BasicAuth
        $content = @()
        $content += "POSTGRES_URL=postgres://${AUTH_USER}:$AUTH_PASS@postgres:5432/$DB_NAME"
        Set-Content -Path $ApiEnv -Value $content -Encoding Ascii
        Write-Host ("   Created Backend root.env: {0}" -f $ApiEnv)
    }
    catch {
        Write-Error "[X] Failed to write Backend credentials: $_"
        exit 1
    }
}
else {
    Write-Host '-> Backend root.env already exists (use FORCE=true to regenerate).'
}

# 6) Final Summary
Write-Host ''
Write-Host '--- [MySpinBot] Provisioning Summary ---'
Write-Host ('   -> BasicAuth user:  {0}' -f $AUTH_USER)
Write-Host ('   -> Domain:          {0}' -f $DOMAIN)
Write-Host ('   -> Project Root:        {0}' -f $RootDir)
Write-Host ('   -> Certificates:    {0}' -f $CertsDir)
Write-Host ('   -> Traefik secrets: {0}' -f $SecretsDir)
Write-Host ('   -> Grafana secrets:   {0}' -f $GrafanaDir)
Write-Host ('   -> MinIO secrets:   {0}' -f $MinioDir)
Write-Host ('   -> PostgreSQL secrets:   {0}' -f $PgDir)
Write-Host ('   -> Backend secrets:   {0}' -f $ApiDir)
Write-Host ''
Write-Host ('✅  Access Grafana web ui at: https://{0}' -f $GrafanaURL)
Write-Host ('    Username: {0}' -f $AUTH_USER)
Write-Host ('    Password: (stored in {0})' -f $GrafanaEnv)
Write-Host ''
Write-Host ('✅  Access MinIO Console at: https://{0}' -f $MinioURL)
Write-Host ('    Username: {0}' -f $AUTH_USER)
Write-Host ('    Password: (stored in {0})' -f $MinioEnv)
Write-Host ''
Write-Host ('✅  Access pgAdmin Console at: https://{0}' -f $pgAdminURL)
Write-Host ('    Username: {0}' -f $AUTH_USER)
Write-Host ('    Password: (stored in {0})' -f $PgEnv)
Write-Host ''
Write-Host ('✅  Access Backend API at: https://{0}' -f $ApiURL)
Write-Host ''
Write-Host '✅ [MySpinBot] Local provisioning complete.'
