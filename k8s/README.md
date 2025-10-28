# Kubernetes Manifests

This directory contains Kubernetes manifests for deploying Deckworthy to any Kubernetes cluster (k3s, k8s, EKS, etc.).

## Directory Structure

```
k8s/
├── base/                          # Base Kubernetes manifests
│   ├── namespace.yaml             # Namespace definition
│   ├── configmap.yaml             # Application configuration
│   ├── secret.yaml.example        # Secret template (copy and fill in)
│   ├── pvc.yaml                   # Persistent volume claim for database
│   ├── deployment.yaml            # Main application deployment
│   ├── service.yaml               # Service definition
│   ├── ingress.yaml               # Ingress configuration
│   ├── cronjob-sync-games.yaml    # CronJob for games sync
│   ├── cronjob-sync-protondb.yaml # CronJob for ProtonDB sync
│   ├── cronjob-sync-prices.yaml   # CronJob for prices sync
│   └── kustomization.yaml         # Kustomize configuration
│
└── overlays/                      # Environment-specific overlays
    ├── dev/                       # Development environment
    ├── test/                      # Test environment
    └── prod/                      # Production environment
```

## Quick Start

### 1. Prepare Secrets

```bash
cd k8s/base
cp secret.yaml.example secret.yaml
nano secret.yaml  # Add your API keys
```

### 2. Update Kustomization

```bash
# Edit kustomization.yaml and uncomment secret.yaml
nano kustomization.yaml
```

### 3. Deploy

```bash
# Deploy base configuration
kubectl apply -k ./base

# Or deploy to specific environment
kubectl apply -k ./overlays/dev
```

### 4. Verify

```bash
kubectl get all -n deckworthy
kubectl logs -n deckworthy -l app=deckworthy
```

## Configuration

### ConfigMap (base/configmap.yaml)

Configure application settings:
- `NODE_ENV` - Environment (production)
- `PORT` - Application port (3000)
- `DATABASE_PATH` - Path to SQLite database
- `CORS_ORIGINS` - Allowed CORS origins
- `SYNC_*_SCHEDULE` - Cron schedules for sync jobs

### Secret (base/secret.yaml)

**Required API keys:**
- `STEAM_API_KEY` - Get from https://steamcommunity.com/dev/apikey
- `ITAD_API_KEY` - Get from https://isthereanydeal.com/dev/app/

Create secret directly:
```bash
kubectl create secret generic deckworthy-secrets \
  --from-literal=STEAM_API_KEY=your-key \
  --from-literal=ITAD_API_KEY=your-key \
  -n deckworthy
```

### Ingress (base/ingress.yaml)

Update `host` field with your domain:
```yaml
spec:
  rules:
  - host: deckworthy.yourdomain.com  # Change this
```

For local testing, use `.local` domain and add to `/etc/hosts`:
```bash
echo "127.0.0.1 deckworthy.local" | sudo tee -a /etc/hosts
```

## Deployment Options

### Option 1: Using Kustomize (Recommended)

```bash
# Base deployment
kubectl apply -k ./base

# Development environment
kubectl apply -k ./overlays/dev

# Production environment
kubectl apply -k ./overlays/prod
```

### Option 2: Direct kubectl

```bash
# Apply all manifests in order
kubectl apply -f base/namespace.yaml
kubectl apply -f base/configmap.yaml
kubectl apply -f base/secret.yaml
kubectl apply -f base/pvc.yaml
kubectl apply -f base/deployment.yaml
kubectl apply -f base/service.yaml
kubectl apply -f base/ingress.yaml
kubectl apply -f base/cronjob-sync-games.yaml
kubectl apply -f base/cronjob-sync-protondb.yaml
kubectl apply -f base/cronjob-sync-prices.yaml
```

### Option 3: Using Terraform

See [../terraform/README.md](../terraform/README.md) for Terraform deployment.

## Storage

### k3s
Uses `local-path` storage class (included by default).

### Other Kubernetes
Update `storageClassName` in `pvc.yaml`:
- **AWS EKS:** `gp3` or `gp2`
- **GKE:** `standard` or `pd-ssd`
- **Azure AKS:** `managed-premium`
- **On-prem:** Configure your storage class

## Scaling

**Important:** The current setup uses SQLite with a ReadWriteOnce volume, limiting deployment to 1 replica.

To scale horizontally:
1. Migrate to PostgreSQL (StatefulSet or external RDS)
2. Update ConfigMap with PostgreSQL connection string
3. Update Deployment strategy to `RollingUpdate`
4. Increase replicas

## CronJobs

Three sync jobs are configured:
- **sync-games:** Weekly (Sunday 3am)
- **sync-protondb:** Daily (2am)
- **sync-prices:** Every 6 hours

Trigger manually:
```bash
kubectl create job -n deckworthy sync-games-manual --from=cronjob/sync-games
```

## Monitoring

Add Prometheus annotations for scraping:
```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "3000"
    prometheus.io/path: "/metrics"
```

See [../docs/MONITORING.md](../docs/MONITORING.md) for full setup.

## Cleanup

```bash
# Delete all resources
kubectl delete -k ./base

# Or delete namespace (removes everything)
kubectl delete namespace deckworthy
```

## Troubleshooting

### Pods not starting
```bash
kubectl describe pod -n deckworthy <pod-name>
kubectl logs -n deckworthy <pod-name>
```

### Image pull errors
```bash
# For k3s, import image
docker save deckworthy:latest | sudo k3s ctr images import -

# List images
sudo k3s crictl images
```

### Storage issues
```bash
kubectl get pvc -n deckworthy
kubectl describe pvc -n deckworthy deckworthy-data
```

### Ingress not working
```bash
kubectl get ingress -n deckworthy
kubectl describe ingress -n deckworthy deckworthy
```

## Documentation

- [K3S Setup](../docs/K3S_SETUP.md)
- [Kubernetes Deployment](../docs/KUBERNETES_DEPLOYMENT.md)
- [CloudFlare Tunnel](../docs/CLOUDFLARE_TUNNEL.md)
- [Monitoring](../docs/MONITORING.md)

## Next Steps

1. Deploy Deckworthy: Follow [KUBERNETES_DEPLOYMENT.md](../docs/KUBERNETES_DEPLOYMENT.md)
2. Expose to internet: Follow [CLOUDFLARE_TUNNEL.md](../docs/CLOUDFLARE_TUNNEL.md)
3. Set up monitoring: Follow [MONITORING.md](../docs/MONITORING.md)
