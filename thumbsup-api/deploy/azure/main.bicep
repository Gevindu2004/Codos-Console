// ThumbsUp APIs on Azure: one template creates everything.
//
//   Container Apps       the API (the Docker image in this folder's parent)
//   PostgreSQL Flexible  the database
//   Blob Storage         Drive Assets copies + email attachments
//   Key Vault            every secret (the app reads them with its managed identity)
//   Communication Svc    email sending (Azure Communication Services Email)
//
// The app logs in to Key Vault and Blob Storage with a managed identity: no storage keys in settings.
// Run it with deploy.sh (or deploy.ps1) - see README-AZURE.md.

@description('Short lower-case name used for every resource, e.g. viacodostu')
@minLength(3)
@maxLength(12)
param prefix string

param location string = resourceGroup().location

@description('Container image, e.g. viacodostuacr.azurecr.io/thumbsup-api:1')
param image string

@description('Name of the Azure Container Registry that holds the image (same resource group)')
param registryName string

@description('Public address of the API, e.g. https://api.viacodos.com')
param publicBaseUrl string

@description('Codos Console address(es), comma separated, e.g. https://console.viacodos.com')
param dashboardOrigins string

@description('Page people return to after Google sign-in, e.g. https://console.viacodos.com/console')
param dashboardUrl string

@description('Public address for Drive Assets files (can be the same as publicBaseUrl)')
param assetsBaseUrl string = publicBaseUrl

@description('Sender address of the email domain connected in Azure Communication Services, e.g. DoNotReply@viacodos.com')
param emailSender string

@description('Data location of the email service (where email data is kept)')
@allowed(['Africa', 'Asia Pacific', 'Australia', 'Brazil', 'Canada', 'Europe', 'France', 'Germany', 'India', 'Japan', 'Korea', 'Norway', 'Switzerland', 'UAE', 'UK', 'United States'])
param emailDataLocation string = 'Asia Pacific'

@description('Database admin user name')
param postgresAdmin string = 'thumbsupadmin'

@secure()
@minLength(16)
@description('Database admin password (letters and numbers, 16+)')
param postgresPassword string

@secure()
@minLength(32)
param jwtSecret string

@secure()
@minLength(32)
param dataEncryptionKey string

@secure()
@minLength(24)
@description('Secret part of the Event Grid -> ThumbsUp delivery-report address')
param acsEventsToken string

@description('Optional: Sign in with Google for Sheets')
param googleOAuthClientId string = ''

@secure()
param googleOAuthClientSecret string = ''

@secure()
@description('Optional: the Google service account JSON (Drive Assets + Sheets robot)')
param googleServiceAccountJson string = ''

@description('Second run only, after the app is live: send email delivery reports (bounces) to the app')
param enableEmailEvents bool = false

@description('Object id of the person running the deployment (can read the secrets again on the next run)')
param deployerObjectId string = ''

@description('Size of each copy: 0.5 CPU + 1 GiB is enough to start; use 1.0 + 2Gi when traffic grows')
@allowed(['0.5', '1.0', '2.0'])
param cpu string = '0.5'

@description('How many copies of the API may run')
@minValue(1)
@maxValue(10)
param maxReplicas int = 3

var tags = { app: 'thumbsup', owner: 'via-codos' }
var uniq = uniqueString(resourceGroup().id, prefix)

// ---------------------------------------------------------------- identity
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-app-id'
  location: location
  tags: tags
}

// ---------------------------------------------------------------- logs
resource logs 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${prefix}-logs'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// ---------------------------------------------------------------- storage (files)
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: take('${prefix}files${uniq}', 24)
  location: location
  tags: tags
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false // files are only served through the API
    allowSharedKeyAccess: false // only identities, never account keys
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    deleteRetentionPolicy: { enabled: true, days: 7 }
  }
}

resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'thumbsup'
  properties: { publicAccess: 'None' }
}

var blobContributor = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe' // Storage Blob Data Contributor
resource blobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storage
  name: guid(storage.id, identity.id, blobContributor)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', blobContributor)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ---------------------------------------------------------------- database
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: '${prefix}-db-${uniq}'
  location: location
  tags: tags
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    version: '16'
    administratorLogin: postgresAdmin
    administratorLoginPassword: postgresPassword
    storage: { storageSizeGB: 32, autoGrow: 'Enabled' }
    backup: { backupRetentionDays: 7, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: 'thumbsup'
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}

// Lets Azure services (our Container App) reach the database. Upgrade to a private network later if needed.
resource pgAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: postgres
  name: 'AllowAzureServices'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
}

// ---------------------------------------------------------------- email
resource emailService 'Microsoft.Communication/emailServices@2023-04-01' = {
  name: '${prefix}-email'
  location: 'global'
  tags: tags
  properties: { dataLocation: emailDataLocation }
}

resource communication 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: '${prefix}-acs-${uniq}'
  location: 'global'
  tags: tags
  properties: {
    dataLocation: emailDataLocation
    // The verified email domain is connected in the portal (it needs DNS records): see README-AZURE.md
  }
}

// ---------------------------------------------------------------- secrets
resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: take('${prefix}-kv-${uniq}', 24)
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 30
    enablePurgeProtection: true
  }
}

var databaseUrl = 'postgresql+psycopg://${postgresAdmin}:${uriComponent(postgresPassword)}@${postgres.properties.fullyQualifiedDomainName}:5432/thumbsup?sslmode=require'

// Names only (known before deployment); the values are written by the secret resources below.
var secretNames = concat(
  [
    { name: 'jwt-secret', env: 'JWT_SECRET' }
    { name: 'data-encryption-key', env: 'DATA_ENCRYPTION_KEY' }
    { name: 'database-url', env: 'DATABASE_URL' }
    { name: 'acs-connection-string', env: 'ACS_CONNECTION_STRING' }
    { name: 'acs-events-token', env: 'ACS_EVENTS_TOKEN' }
  ],
  empty(googleOAuthClientSecret) ? [] : [{ name: 'google-oauth-secret', env: 'GOOGLE_OAUTH_CLIENT_SECRET' }],
  empty(googleServiceAccountJson) ? [] : [{ name: 'google-service-account', env: 'GOOGLE_SERVICE_ACCOUNT_JSON' }]
)

resource secretJwt 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'jwt-secret'
  properties: { value: jwtSecret }
}

resource secretDataKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'data-encryption-key'
  properties: { value: dataEncryptionKey }
}

resource secretDatabase 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'database-url'
  properties: { value: databaseUrl }
}

resource secretAcs 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'acs-connection-string'
  properties: { value: communication.listKeys().primaryConnectionString }
}

resource secretAcsEvents 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'acs-events-token'
  properties: { value: acsEventsToken }
}

resource secretGoogle 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(googleOAuthClientSecret)) {
  parent: vault
  name: 'google-oauth-secret'
  properties: { value: googleOAuthClientSecret }
}

resource secretRobot 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(googleServiceAccountJson)) {
  parent: vault
  name: 'google-service-account'
  properties: { value: googleServiceAccountJson }
}

resource secretPostgres 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'postgres-password'
  properties: { value: postgresPassword }
}

var secretsOfficer = 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7' // Key Vault Secrets Officer
resource deployerRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(deployerObjectId)) {
  scope: vault
  name: guid(vault.id, deployerObjectId, secretsOfficer)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', secretsOfficer)
    principalId: deployerObjectId
    principalType: 'User'
  }
}

var secretsUser = '4633458b-17de-408a-b874-0445c86b69e6' // Key Vault Secrets User
resource vaultRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: vault
  name: guid(vault.id, identity.id, secretsUser)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', secretsUser)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ---------------------------------------------------------------- image registry
resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: registryName
}

var acrPull = '7f951dda-4ed3-4680-a7ca-43fe172d538d' // AcrPull
resource pullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: registry
  name: guid(registry.id, identity.id, acrPull)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPull)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ---------------------------------------------------------------- the API
resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${prefix}-env'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

var plainEnv = [
  { name: 'ENVIRONMENT', value: 'production' }
  { name: 'COOKIE_SECURE', value: 'true' }
  { name: 'PUBLIC_BASE_URL', value: publicBaseUrl }
  { name: 'ASSETS_BASE_URL', value: assetsBaseUrl }
  { name: 'DASHBOARD_ORIGINS', value: dashboardOrigins }
  { name: 'DASHBOARD_URL', value: dashboardUrl }
  { name: 'TRUSTED_PROXY_HOPS', value: '1' } // Container Apps' own front door adds one X-Forwarded-For entry
  { name: 'EMAIL_PROVIDER', value: 'acs' }
  { name: 'DEFAULT_FROM_EMAIL', value: emailSender }
  { name: 'ASSET_STORAGE', value: 'azure' }
  { name: 'AZURE_STORAGE_ACCOUNT_URL', value: storage.properties.primaryEndpoints.blob }
  { name: 'AZURE_STORAGE_CONTAINER', value: container.name }
  { name: 'AZURE_CLIENT_ID', value: identity.properties.clientId } // which identity DefaultAzureCredential uses
  { name: 'GOOGLE_OAUTH_CLIENT_ID', value: googleOAuthClientId }
]
var secretEnv = [for s in secretNames: { name: s.env, secretRef: s.name }]

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-api'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identity.id}': {} }
  }
  dependsOn: [vaultRole, pullRole, blobRole, secretJwt, secretDataKey, secretDatabase, secretAcs, secretAcsEvents, secretGoogle, secretRobot, database, pgAzure]
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8001
        transport: 'auto'
        allowInsecure: false
      }
      registries: [{ server: registry.properties.loginServer, identity: identity.id }]
      secrets: [for s in secretNames: {
        name: s.name
        keyVaultUrl: '${vault.properties.vaultUri}secrets/${s.name}'
        identity: identity.id
      }]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: image
          resources: { cpu: json(cpu), memory: cpu == '0.5' ? '1Gi' : (cpu == '1.0' ? '2Gi' : '4Gi') }
          env: concat(plainEnv, secretEnv)
          probes: [
            { type: 'Startup', httpGet: { path: '/health', port: 8001 }, periodSeconds: 5, failureThreshold: 30 }
            { type: 'Liveness', httpGet: { path: '/health', port: 8001 }, periodSeconds: 30 }
            { type: 'Readiness', httpGet: { path: '/health', port: 8001 }, periodSeconds: 10 }
          ]
        }
      ]
      scale: {
        minReplicas: 1 // the email queue, Drive sync and Sheets writer run inside the app
        maxReplicas: maxReplicas
        rules: [{ name: 'http', http: { metadata: { concurrentRequests: '50' } } }]
      }
    }
  }
}

// ---------------------------------------------------------------- email delivery reports (2nd run)
resource emailTopic 'Microsoft.EventGrid/systemTopics@2024-06-01-preview' = if (enableEmailEvents) {
  name: '${prefix}-email-events'
  location: 'global'
  tags: tags
  properties: {
    source: communication.id
    topicType: 'Microsoft.Communication.CommunicationServices'
  }
}

resource emailSubscription 'Microsoft.EventGrid/systemTopics/eventSubscriptions@2024-06-01-preview' = if (enableEmailEvents) {
  parent: emailTopic
  name: 'thumbsup-delivery-reports'
  properties: {
    destination: {
      endpointType: 'WebHook'
      #disable-next-line use-secure-value-for-secure-inputs // the token is only the private part of our own URL
      properties: { endpointUrl: '${publicBaseUrl}/v1/providers/acs/events/${acsEventsToken}' }
    }
    filter: { includedEventTypes: ['Microsoft.Communication.EmailDeliveryReportReceived'] }
    retryPolicy: { maxDeliveryAttempts: 30, eventTimeToLiveInMinutes: 1440 }
  }
}

output apiUrl string = 'https://${app.properties.configuration.ingress.fqdn}'
output keyVault string = vault.name
output storageAccount string = storage.name
output database string = postgres.properties.fullyQualifiedDomainName
output communicationService string = communication.name
output emailService string = emailService.name
