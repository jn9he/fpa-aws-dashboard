# FPA AWS Dashboard — Azure Deployment Guide

## Architecture

```
User → (Entra ID Login) → Azure Static Web Apps (React)
                               ↓ /api/* proxy
                          Azure Container App (FastAPI)
                               ↓                ↓
                     Azure OpenAI Service   Azure Files (scenarios.db)
```

## Azure Resources Required

| Resource | SKU/Plan | Purpose |
|----------|----------|---------|
| Azure Static Web App | Free | Host React frontend + built-in auth |
| Azure Container App | Consumption | Host FastAPI backend |
| Container Apps Environment | — | Networking/runtime for Container App |
| Azure Container Registry | Basic | Store Docker images |
| Azure Storage Account | Standard_LRS | Persistent file share for SQLite DB |
| Azure OpenAI Service | (existing) | AI/RAG features |

## Prerequisites

- Azure CLI installed (`az --version`)
- Logged in (`az login`)
- A resource group created (referred to as `<your-rg>` below)
- GitHub repo with the project code pushed
- Azure OpenAI resource already provisioned (endpoint + deployment name + API key)

---

## Step 1: Create Azure Container Registry (ACR)

```bash
# Create the registry
az acr create --resource-group <your-rg> --name fpadashboardacr --sku Basic

# Enable admin access (needed for Container Apps to pull images)
az acr update -n fpadashboardacr --admin-enabled true

# Get the admin password (save this)
az acr credential show --name fpadashboardacr --query "passwords[0].value" -o tsv
```

## Step 2: Build and Push the Backend Docker Image

From the project root directory:

```bash
az acr build --registry fpadashboardacr --image fpa-backend:v1 ./backend
```

This builds the image in the cloud — no local Docker installation required.

Verify:
```bash
az acr repository list --name fpadashboardacr -o table
```

## Step 3: Create Azure Storage for SQLite Persistence

```bash
# Create storage account
az storage account create \
  --name fpadashboardstorage \
  --resource-group <your-rg> \
  --sku Standard_LRS \
  --kind StorageV2

# Create a file share
az storage share create \
  --name dbdata \
  --account-name fpadashboardstorage

# Get the storage account key (save this)
az storage account keys list \
  --account-name fpadashboardstorage \
  --query "[0].value" -o tsv
```

## Step 4: Create Container Apps Environment

```bash
az containerapp env create \
  --name fpa-env \
  --resource-group <your-rg> \
  --location <region>
```

Replace `<region>` with your Azure region (e.g., `eastus`, `westus2`, `centralus`).

## Step 5: Mount Azure Files to the Environment

```bash
az containerapp env storage set \
  --name fpa-env \
  --resource-group <your-rg> \
  --storage-name fpadashboardstorage \
  --azure-file-account-name fpadashboardstorage \
  --azure-file-account-key <storage-key> \
  --azure-file-share-name dbdata \
  --access-mode ReadWrite
```

## Step 6: Deploy the Container App

```bash
az containerapp create \
  --name fpa-backend \
  --resource-group <your-rg> \
  --environment fpa-env \
  --image fpadashboardacr.azurecr.io/fpa-backend:v1 \
  --registry-server fpadashboardacr.azurecr.io \
  --registry-username fpadashboardacr \
  --registry-password <acr-password> \
  --target-port 8000 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 1 \
  --secrets "openai-key=<your-azure-openai-key>" \
  --env-vars "AZURE_OPENAI_API_KEY=secretref:openai-key" \
             "AZURE_OPENAI_ENDPOINT=<your-azure-openai-endpoint>" \
             "AZURE_OPENAI_DEPLOYMENT=<your-deployment-name>" \
             "AZURE_OPENAI_API_VERSION=2024-10-21" \
             "DATABASE_URL=sqlite:////mnt/dbdata/scenarios.db" \
             "ALLOWED_ORIGINS=*"
```

## Step 7: Add Volume Mount to the Container App

The CLI `create` command doesn't support volume mounts directly. Use a YAML update:

```bash
# Export current config
az containerapp show --name fpa-backend --resource-group <your-rg> -o yaml > app.yaml
```

Edit `app.yaml` to add volumes under `template`:

```yaml
template:
  containers:
    - name: fpa-backend
      image: fpadashboardacr.azurecr.io/fpa-backend:v1
      # ... existing config ...
      volumeMounts:
        - volumeName: dbdata
          mountPath: /mnt/dbdata
  volumes:
    - name: dbdata
      storageType: AzureFile
      storageName: fpadashboardstorage
```

Apply the update:
```bash
az containerapp update --name fpa-backend --resource-group <your-rg> --yaml app.yaml
```

## Step 8: Verify the Backend

```bash
# Get the Container App URL
az containerapp show --name fpa-backend --resource-group <your-rg> --query "properties.configuration.ingress.fqdn" -o tsv

# Test health endpoint
curl https://<your-container-app-url>/health
# Should return: {"status":"ok"}
```

## Step 9: Deploy the Frontend (Azure Static Web Apps)

### In Azure Portal:
1. Go to **Create a resource** → **Static Web App**
2. Fill in:
   - **Resource group**: `<your-rg>`
   - **Name**: `fpa-dashboard-frontend`
   - **Plan type**: Free
   - **Source**: GitHub
   - **Organization/Repo/Branch**: Select your GitHub repo and main branch
   - **Build preset**: Vite
   - **App location**: `/frontend`
   - **Output location**: `dist`
   - **API location**: Leave blank
3. Click **Review + Create** → **Create**

This triggers a GitHub Action that builds and deploys the frontend automatically.

## Step 10: Link the Backend to Static Web Apps

```bash
# Get the Container App resource ID
az containerapp show --name fpa-backend --resource-group <your-rg> --query "id" -o tsv

# Link it as the backend
az staticwebapp backends link \
  --name fpa-dashboard-frontend \
  --resource-group <your-rg> \
  --backend-resource-id <container-app-resource-id> \
  --backend-region <region>
```

This makes all `/api/*` requests from the Static Web App proxy to the Container App.

## Step 11: Configure Authentication (Entra ID)

1. In Azure Portal, navigate to your Static Web App
2. Go to **Settings** → **Authentication**
3. Click **Add identity provider**
4. Select **Microsoft** (Entra ID)
5. Leave defaults (creates an app registration automatically)
6. Click **Add**

The `staticwebapp.config.json` in the repo handles:
- Unauthenticated users → redirected to `/.auth/login/aad`
- Authenticated users → access to all routes and `/api/*`

## Step 12: Update CORS on the Backend

After deploying, get the Static Web App URL:
```bash
az staticwebapp show --name fpa-dashboard-frontend --resource-group <your-rg> --query "defaultHostname" -o tsv
```

Update the backend's ALLOWED_ORIGINS:
```bash
az containerapp update \
  --name fpa-backend \
  --resource-group <your-rg> \
  --set-env-vars "ALLOWED_ORIGINS=https://<your-swa-hostname>"
```

---

## Redeployment

### Frontend (automatic)
Push to the GitHub branch configured in the Static Web App. The GitHub Action rebuilds and deploys automatically.

### Backend (manual)
```bash
# Rebuild the image
az acr build --registry fpadashboardacr --image fpa-backend:v2 ./backend

# Update the Container App to use the new image
az containerapp update \
  --name fpa-backend \
  --resource-group <your-rg> \
  --image fpadashboardacr.azurecr.io/fpa-backend:v2
```

## Updating CSV Data

Since CSVs are bundled in the Docker image, updating them requires a backend redeploy:
1. Update the CSV files in `backend/data/`
2. Commit and push to GitHub
3. Rebuild and redeploy the backend (see above)

## Environment Variables Reference

| Variable | Location | Description |
|----------|----------|-------------|
| `AZURE_OPENAI_API_KEY` | Container App secret | Azure OpenAI API key |
| `AZURE_OPENAI_ENDPOINT` | Container App env var | Azure OpenAI endpoint URL |
| `AZURE_OPENAI_DEPLOYMENT` | Container App env var | Model deployment name |
| `AZURE_OPENAI_API_VERSION` | Container App env var | API version (2024-10-21) |
| `DATABASE_URL` | Container App env var | SQLite path on mounted volume |
| `ALLOWED_ORIGINS` | Container App env var | Static Web App URL for CORS |

## Troubleshooting

### Backend won't start
```bash
az containerapp logs show --name fpa-backend --resource-group <your-rg> --follow
```

### API calls return 401
- Ensure you're logged in via the Static Web App auth
- Check that the backend is linked: `az staticwebapp backends show --name fpa-dashboard-frontend --resource-group <your-rg>`

### Scenarios not persisting
- Verify the volume mount: `az containerapp show --name fpa-backend --resource-group <your-rg> -o yaml | grep -A5 volume`
- Check the file share has write access

### Azure OpenAI errors
- Verify the endpoint and key are correct in Container App secrets
- Check the deployment name matches what's provisioned in Azure OpenAI Studio
