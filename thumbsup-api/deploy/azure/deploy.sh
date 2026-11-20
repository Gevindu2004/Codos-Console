#!/usr/bin/env bash
# ThumbsUp APIs -> Azure (macOS / Linux / Azure Cloud Shell). Same as deploy.ps1.
# Before: install the Azure CLI, then: az login.   Run from this folder: ./deploy.sh
set -euo pipefail

# ---------------- 1. Fill these in ----------------
PREFIX="viacodostu"
LOCATION="centralindia"
PUBLIC_BASE_URL="https://api.viacodos.com"
DASHBOARD_ORIGINS="https://console.viacodos.com"
DASHBOARD_URL="https://console.viacodos.com/console"
EMAIL_SENDER="DoNotReply@viacodos.com"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_ROBOT_JSON_FILE=""
ENABLE_EMAIL_EVENTS=false   # true on the second run, after the app is live
# ---------------------------------------------------

GROUP="$PREFIX-rg"; REGISTRY="${PREFIX}acr"; TAG=$(date +%Y%m%d%H%M)
new_secret() { python3 -c "import secrets; print(secrets.token_urlsafe(36).replace('-', '').replace('_', '') + 'Aa9')"; }

echo "1/5 Resource group and image registry..."
az group create -n "$GROUP" -l "$LOCATION" -o none
az acr show -n "$REGISTRY" -g "$GROUP" -o none 2>/dev/null || az acr create -n "$REGISTRY" -g "$GROUP" --sku Basic -o none

echo "2/5 Building the server image in Azure..."
az acr build -r "$REGISTRY" -t "thumbsup-api:$TAG" ../.. -o none
IMAGE="$REGISTRY.azurecr.io/thumbsup-api:$TAG"

echo "3/5 Secrets (kept the same on later runs)..."
VAULT=$(az deployment group show -g "$GROUP" -n thumbsup --query properties.outputs.keyVault.value -o tsv 2>/dev/null || true)
get_or_new() {
  local v=""
  [ -n "$VAULT" ] && v=$(az keyvault secret show --vault-name "$VAULT" -n "$1" --query value -o tsv 2>/dev/null || true)
  [ -n "$v" ] && echo "$v" || new_secret
}
JWT=$(get_or_new jwt-secret); DATA_KEY=$(get_or_new data-encryption-key)
EVENTS=$(get_or_new acs-events-token); PG=$(get_or_new postgres-password)
ME=$(az ad signed-in-user show --query id -o tsv)
ROBOT=""; [ -n "$GOOGLE_ROBOT_JSON_FILE" ] && ROBOT=$(cat "$GOOGLE_ROBOT_JSON_FILE")

echo "4/5 Creating / updating everything (first time ~10 minutes)..."
PARAMS=$(mktemp); trap 'rm -f "$PARAMS"' EXIT   # contains secrets
python3 - "$PARAMS" <<PY
import json, sys
p = dict(prefix="$PREFIX", image="$IMAGE", registryName="$REGISTRY", publicBaseUrl="$PUBLIC_BASE_URL",
         dashboardOrigins="$DASHBOARD_ORIGINS", dashboardUrl="$DASHBOARD_URL", emailSender="$EMAIL_SENDER",
         postgresPassword="$PG", jwtSecret="$JWT", dataEncryptionKey="$DATA_KEY", acsEventsToken="$EVENTS",
         googleOAuthClientId="$GOOGLE_CLIENT_ID", googleOAuthClientSecret="$GOOGLE_CLIENT_SECRET",
         googleServiceAccountJson=open("$GOOGLE_ROBOT_JSON_FILE").read() if "$GOOGLE_ROBOT_JSON_FILE" else "",
         enableEmailEvents="$ENABLE_EMAIL_EVENTS" == "true", deployerObjectId="$ME")
json.dump({"\$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
           "contentVersion": "1.0.0.0", "parameters": {k: {"value": v} for k, v in p.items()}}, open(sys.argv[1], "w"))
PY
az deployment group create -g "$GROUP" -n thumbsup -f main.bicep -p "@$PARAMS" -o none

echo "5/5 Done!"
URL=$(az deployment group show -g "$GROUP" -n thumbsup --query properties.outputs.apiUrl.value -o tsv)
echo "API (temporary address): $URL"
echo "Test it: $URL/health"
