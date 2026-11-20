# ThumbsUp APIs -> Azure, in one go (Windows PowerShell or PowerShell 7).
#
# Before you start: install the Azure CLI (https://aka.ms/installazurecliwindows), then run:  az login
# Run from this folder:   .\deploy.ps1
# Running it again later updates the app (new code, new settings). Secrets are kept in Key Vault.

# ---------------- 1. Fill these in ----------------
$Prefix           = "viacodostu"                            # 3-12 lower-case letters/numbers, unique to you
$Location         = "centralindia"                          # closest Azure region to Sri Lanka
$PublicBaseUrl    = "https://api.viacodos.com"              # the API's address (set up in step 6 of the guide)
$DashboardOrigins = "https://console.viacodos.com"          # where Codos Console runs
$DashboardUrl     = "https://console.viacodos.com/console"
$EmailSender      = "DoNotReply@viacodos.com"               # after connecting viacodos.com in the email service
$GoogleClientId   = ""                                      # optional (Sheets: Sign in with Google)
$GoogleClientSecret = ""                                    # optional
$GoogleRobotJsonFile = ""                                   # optional path to the service account .json
$EnableEmailEvents = $false                                 # set to $true on the second run (after the app is live)
# ---------------------------------------------------

# Azure CLI prints warnings on stderr; check its exit codes instead of stopping on every message.
$ErrorActionPreference = "Continue"
function Assert-Ok($what) { if ($LASTEXITCODE -ne 0) { Write-Host "FAILED: $what" -ForegroundColor Red; exit 1 } }
$Group = "$Prefix-rg"
$Registry = ($Prefix + "acr")
$Tag = Get-Date -Format "yyyyMMddHHmm"

function New-Secret {
  $bytes = New-Object byte[] 36
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return ([Convert]::ToBase64String($bytes) -replace '[+/=]', '') + "Aa9"
}

Write-Host "1/5 Resource group and image registry..." -ForegroundColor Cyan
az group create -n $Group -l $Location -o none; Assert-Ok "create the resource group (did you run az login?)"
if (-not (az acr show -n $Registry -g $Group --query name -o tsv 2>$null)) {
  az acr create -n $Registry -g $Group --sku Basic -o none; Assert-Ok "create the image registry (try another `$Prefix)"
}

Write-Host "2/5 Building the server image in Azure (no Docker needed on this computer)..." -ForegroundColor Cyan
az acr build -r $Registry -t "thumbsup-api:$Tag" ..\.. -o none; Assert-Ok "build the image"
$Image = "$Registry.azurecr.io/thumbsup-api:$Tag"

Write-Host "3/5 Secrets (new on the first run, the same ones again on later runs)..." -ForegroundColor Cyan
$Vault = az deployment group show -g $Group -n thumbsup --query properties.outputs.keyVault.value -o tsv 2>$null
function Get-OrNew($name) {
  if ($Vault) {
    $v = az keyvault secret show --vault-name $Vault -n $name --query value -o tsv 2>$null
    if ($v) { return $v }
  }
  return New-Secret
}
$Jwt = Get-OrNew "jwt-secret"
$DataKey = Get-OrNew "data-encryption-key"
$EventsToken = Get-OrNew "acs-events-token"
$PgPassword = Get-OrNew "postgres-password"
$Me = az ad signed-in-user show --query id -o tsv; Assert-Ok "read your Azure account"
$RobotJson = ""
if ($GoogleRobotJsonFile) { $RobotJson = Get-Content $GoogleRobotJsonFile -Raw }

Write-Host "4/5 Creating / updating everything (database, storage, Key Vault, email, the API). First time: ~10 minutes..." -ForegroundColor Cyan
$params = @{
  prefix = $Prefix; image = $Image; registryName = $Registry; publicBaseUrl = $PublicBaseUrl
  dashboardOrigins = $DashboardOrigins; dashboardUrl = $DashboardUrl; emailSender = $EmailSender
  postgresPassword = $PgPassword; jwtSecret = $Jwt; dataEncryptionKey = $DataKey; acsEventsToken = $EventsToken
  googleOAuthClientId = $GoogleClientId; googleOAuthClientSecret = $GoogleClientSecret
  googleServiceAccountJson = $RobotJson; enableEmailEvents = $EnableEmailEvents; deployerObjectId = $Me
}
$paramFile = New-TemporaryFile
$wrapped = @{}
foreach ($k in $params.Keys) { $wrapped[$k] = @{ value = $params[$k] } }
$json = @{ '$schema' = 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#'
           contentVersion = '1.0.0.0'; parameters = $wrapped } | ConvertTo-Json -Depth 5
[IO.File]::WriteAllText($paramFile.FullName, $json)   # no BOM (the Azure CLI can't read one)
try {
  az deployment group create -g $Group -n thumbsup -f main.bicep -p "@$($paramFile.FullName)" -o none
  Assert-Ok "deploy (scroll up for Azure's message)"
} finally {
  Remove-Item $paramFile.FullName -ErrorAction SilentlyContinue   # it contains secrets
}

Write-Host "5/5 Done!" -ForegroundColor Green
$out = az deployment group show -g $Group -n thumbsup --query properties.outputs -o json | ConvertFrom-Json
Write-Host ("API (temporary address): " + $out.apiUrl.value)
Write-Host ("Test it:                 " + $out.apiUrl.value + "/health")
Write-Host "Next: add your own domain to the API, connect the email domain, then run again with `$EnableEmailEvents = `$true (see the guide)."
