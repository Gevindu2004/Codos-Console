# ThumbsUp on Azure

One script creates everything in Azure and puts the API online.

| Part | Azure service | Notes |
|---|---|---|
| The API | Azure Container Apps | 1 to 3 copies, grows with traffic, HTTPS included |
| Database | Azure Database for PostgreSQL (Flexible, B1ms) | daily backups, 7 days |
| Files | Azure Blob Storage | Drive Assets copies, email attachments, download links |
| Secrets | Azure Key Vault | the app reads them with its own identity |
| Email | Azure Communication Services Email | bounces come back through Event Grid |
| Logs | Log Analytics | 30 days |

Nothing secret is written in the app's settings: the app logs in to Key Vault and Blob Storage
with a **managed identity**, and Blob Storage doesn't even accept account keys.

## Before you start

1. An Azure subscription where you are **Owner** (it creates role assignments).
2. The **Azure CLI**: https://learn.microsoft.com/cli/azure/install-azure-cli, then `az login`.
3. No Docker needed: the image is built inside Azure (`az acr build`).

## Deploy

Open `deploy.ps1` (Windows) or `deploy.sh` (Mac/Linux/Cloud Shell), fill in the lines at the top, run it:

```powershell
cd thumbsup-api\deploy\azure
.\deploy.ps1
```

The first run takes about 10 minutes. At the end it prints the API's address. Open `<address>/health`:
it should say `"status":"ok"`.

Running the script again later **updates** the app (new code or settings). The secrets are read back from
Key Vault, so nobody is logged out and saved Google connections keep working.

## After the first run

1. **Email domain.** Azure portal → the *Email Communication Service* (`<prefix>-email`) → *Provision domains*
   → *Add domain* → *Custom domain* → `viacodos.com`. Add the TXT, SPF and DKIM records it shows at your DNS
   provider, wait for *Verified*, then *Connect domain* to the Communication Service (`<prefix>-acs-...`).
   The default sender is `DoNotReply@viacodos.com` (its display name is set on the domain's *MailFrom addresses*).
2. **Your own address for the API.** Container App (`<prefix>-api`) → *Custom domains* → add `api.viacodos.com`
   (a CNAME + TXT record), with a free managed certificate.
3. **Turn on bounce tracking.** Set `$EnableEmailEvents = $true` in the script and run it again.
   Event Grid then reports bounced and blocked emails to ThumbsUp, which stops sending to dead addresses.
4. **Sending limits.** New Azure email domains start at about 30 emails per minute and 100 per hour. Before going
   live, ask for more: Azure portal → *Help + support* → *Create a support request* → *Service and subscription
   limits (quotas)* → *Azure Communication Services Email: Sending Limits*.
5. **Codos Console.** Set `NEXT_PUBLIC_THUMBSUP_API_URL=https://api.viacodos.com` where the console is built.

## Checked before delivery

- `main.bicep` compiles and passes the Bicep linter (`bicep build`, `bicep lint`).
- The whole test suite passes on PostgreSQL 16, and all database migrations run up, down and up again.
- Azure Blob Storage was tested against Azurite (Microsoft's local emulator): Drive Assets files, video byte ranges,
  email attachments and download links.
- Azure email was tested with Microsoft's own Python SDK against a fake endpoint: signed requests, recipients,
  attachments, the retry id (an email is never sent twice), 429/400 handling, and Event Grid reports.
- Scale-out: two copies of the API (4 processes) on one database and one storage account started together,
  sent 120 emails in parallel: every email arrived exactly once, and download links worked from either copy.

## Costs (small start, pay as you go)

Roughly 30 to 40 USD a month to start, plus about 0.25 USD per 1,000 emails:

| Part | About |
|---|---|
| PostgreSQL B1ms + 32 GB storage | 15-20 USD |
| Container Apps, one copy of 0.5 CPU / 1 GiB always on (mostly at the cheaper idle rate) | 10-15 USD |
| Container Registry Basic | 5 USD |
| Key Vault, Blob Storage, Log Analytics (small use) | 1-5 USD |
| Email | 0.25 USD per 1,000 emails + 0.12 USD per GB of attachments |

Bigger traffic: set `cpu` to `1.0` and raise `maxReplicas`. Check the Azure pricing calculator for your region.
