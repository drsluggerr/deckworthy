# Kubernetes Deployment Guide

This guide covers deploying Deckworthy to Kubernetes using either kubectl directly or Terraform.

## Prerequisites

- k3s or Kubernetes cluster running (see [K3S_SETUP.md](K3S_SETUP.md))
- kubectl configured and working
- Docker image built (or using pre-built image)
- API keys (Steam, IsThereAnyDeal)

## Option 1: Deploy with Terraform (Recommended)

Terraform provides infrastructure as code, making it easier to manage and version your deployment.

### 1. Install Terraform

```bash
# Linux (Ubuntu/Debian)
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform

# macOS
brew install terraform

# Verify
terraform version
```

### 2. Build Docker Image

```bash
# From project root
docker build -t deckworthy:latest .

# For k3s, import the image (no registry needed)
sudo k3s ctr images import deckworthy-latest.tar

# Or save and import
docker save deckworthy:latest > deckworthy-latest.tar
sudo k3s ctr images import deckworthy-latest.tar
```

### 3. Configure Terraform

```bash
# Navigate to terraform directory
cd terraform/environments/local

# Copy example tfvars
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars
```

**Update these values in `terraform.tfvars`:**

```hcl
# Path to kubeconfig
kubeconfig_path = "~/.kube/config"  # or "/etc/rancher/k3s/k3s.yaml"

# API Keys (required!)
steam_api_key = "your-steam-api-key-here"
itad_api_key  = "your-itad-api-key-here"

# Ingress hostname
ingress_host = "deckworthy.local"

# CORS origins
cors_origins = "http://localhost:3000,http://deckworthy.local"

# Adjust resources based on your server
resources_requests_cpu    = "100m"
resources_requests_memory = "256Mi"
resources_limits_cpu      = "500m"
resources_limits_memory   = "512Mi"
```

### 4. Deploy with Terraform

```bash
# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Apply configuration
terraform apply

# Type 'yes' to confirm
```

### 5. Verify Deployment

```bash
# Check resources
kubectl get all -n deckworthy

# Check pods
kubectl get pods -n deckworthy

# Check logs
kubectl logs -n deckworthy -l app=deckworthy

# Check cronjobs
kubectl get cronjobs -n deckworthy
```

### 6. Access the Application

Add the hostname to your hosts file:

```bash
# Linux/Mac
echo "127.0.0.1 deckworthy.local" | sudo tee -a /etc/hosts

# Windows (run as Administrator)
Add-Content -Path C:\Windows\System32\drivers\etc\hosts -Value "127.0.0.1 deckworthy.local"
```

Visit http://deckworthy.local in your browser.

## Option 2: Deploy with kubectl

If you prefer not to use Terraform, you can deploy directly with kubectl.

### 1. Build and Load Docker Image

```bash
# Build
docker build -t deckworthy:latest .

# Save for k3s
docker save deckworthy:latest | sudo k3s ctr images import -
```

### 2. Create Secret

```bash
# Copy example
cd k8s/base
cp secret.yaml.example secret.yaml

# Edit with your API keys
nano secret.yaml

# Or create directly with kubectl
kubectl create secret generic deckworthy-secrets \
  --from-literal=STEAM_API_KEY=your-key \
  --from-literal=ITAD_API_KEY=your-key \
  -n deckworthy --dry-run=client -o yaml > secret.yaml
```

### 3. Update Kustomization

```bash
# Edit k8s/base/kustomization.yaml
nano kustomization.yaml

# Uncomment the secret.yaml line
resources:
  - secret.yaml  # Uncomment this
```

### 4. Deploy with Kustomize

```bash
# From k8s/base directory
kubectl apply -k .

# Or for specific environment
kubectl apply -k ../overlays/dev
```

### 5. Verify Deployment

```bash
# Check all resources
kubectl get all -n deckworthy

# Watch pods starting
kubectl get pods -n deckworthy -w

# Check logs
kubectl logs -n deckworthy -l app=deckworthy -f
```

## Initial Database Setup

The database will be created automatically on first startup. To manually initialize:

```bash
# Get pod name
POD=$(kubectl get pod -n deckworthy -l app=deckworthy -o jsonpath='{.items[0].metadata.name}')

# Initialize database
kubectl exec -n deckworthy $POD -- node dist/db/init.js

# Run initial sync (optional)
kubectl exec -n deckworthy $POD -- node dist/jobs/sync-games.js 100
kubectl exec -n deckworthy $POD -- node dist/jobs/sync-protondb.js 100
kubectl exec -n deckworthy $POD -- node dist/jobs/sync-prices.js 100
```

## Managing the Deployment

### View Logs

```bash
# Application logs
kubectl logs -n deckworthy -l app=deckworthy -f

# Specific pod
kubectl logs -n deckworthy deckworthy-xxxxx-xxxxx -f

# CronJob logs
kubectl logs -n deckworthy -l job=sync-games
```

### Manual Sync Jobs

```bash
# Trigger sync manually
kubectl create job -n deckworthy sync-games-manual --from=cronjob/sync-games

# Watch job progress
kubectl get jobs -n deckworthy -w

# Check job logs
kubectl logs -n deckworthy job/sync-games-manual
```

### Update Configuration

```bash
# Edit ConfigMap
kubectl edit configmap -n deckworthy deckworthy-config

# Edit Secret
kubectl edit secret -n deckworthy deckworthy-secrets

# Restart pods to pick up changes
kubectl rollout restart deployment -n deckworthy deckworthy
```

### Scale Deployment

**Note:** Keep replicas=1 when using SQLite. For multiple replicas, migrate to PostgreSQL.

```bash
# Scale to 1 (default)
kubectl scale deployment -n deckworthy deckworthy --replicas=1
```

### Update Image

```bash
# Build new image
docker build -t deckworthy:v1.1 .

# Import to k3s
docker save deckworthy:v1.1 | sudo k3s ctr images import -

# Update deployment
kubectl set image deployment/deckworthy -n deckworthy deckworthy=deckworthy:v1.1

# Or with Terraform
# Update image in terraform.tfvars and run:
terraform apply
```

### Rollback Deployment

```bash
# View rollout history
kubectl rollout history deployment -n deckworthy deckworthy

# Rollback to previous version
kubectl rollout undo deployment -n deckworthy deckworthy

# Rollback to specific revision
kubectl rollout undo deployment -n deckworthy deckworthy --to-revision=2
```

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n deckworthy

# Describe pod for events
kubectl describe pod -n deckworthy deckworthy-xxxxx-xxxxx

# Check logs
kubectl logs -n deckworthy deckworthy-xxxxx-xxxxx
```

### Image Pull Errors

```bash
# List images in k3s
sudo k3s crictl images | grep deckworthy

# If missing, import again
docker save deckworthy:latest | sudo k3s ctr images import -
```

### Storage Issues

```bash
# Check PVC
kubectl get pvc -n deckworthy

# Describe PVC
kubectl describe pvc -n deckworthy deckworthy-data

# Check local-path provisioner
kubectl get pods -n kube-system | grep local-path
```

### CronJobs Not Running

```bash
# List cronjobs
kubectl get cronjobs -n deckworthy

# Describe cronjob
kubectl describe cronjob -n deckworthy sync-games

# Check job history
kubectl get jobs -n deckworthy

# Manually trigger
kubectl create job -n deckworthy test-sync --from=cronjob/sync-games
```

### Ingress Not Working

```bash
# Check ingress
kubectl get ingress -n deckworthy

# Describe ingress
kubectl describe ingress -n deckworthy deckworthy

# Check Traefik (k3s default)
kubectl get pods -n kube-system | grep traefik

# Check Traefik logs
kubectl logs -n kube-system -l app.kubernetes.io/name=traefik
```

### Database Permission Issues

```bash
# Check pod security context
kubectl describe pod -n deckworthy deckworthy-xxxxx-xxxxx | grep -A 10 "Security Context"

# Fix permissions on PV (if needed)
kubectl exec -n deckworthy deckworthy-xxxxx-xxxxx -- ls -la /app/data
```

## Cleanup

### Remove Deployment (Keep Data)

```bash
# With Terraform
cd terraform/environments/local
terraform destroy -target=module.deckworthy.kubernetes_deployment.deckworthy

# With kubectl
kubectl delete deployment -n deckworthy deckworthy
kubectl delete service -n deckworthy deckworthy
kubectl delete ingress -n deckworthy deckworthy
kubectl delete cronjobs -n deckworthy --all
```

### Complete Removal

```bash
# With Terraform
terraform destroy

# With kubectl
kubectl delete namespace deckworthy

# Note: This deletes the database!
```

## Advanced Configuration

### Using PostgreSQL Instead of SQLite

1. Deploy PostgreSQL (as StatefulSet or external)
2. Update ConfigMap with PostgreSQL connection string
3. Update application code to use PostgreSQL
4. Increase replicas if desired

### Setting Up TLS

1. Install cert-manager:
```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
```

2. Create ClusterIssuer:
```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: traefik
```

3. Update ingress with TLS annotation
4. Set `enable_tls = true` in Terraform

### Resource Monitoring

See [MONITORING.md](MONITORING.md) for Grafana Cloud setup.

## Next Steps

- [Set up CloudFlare Tunnel](CLOUDFLARE_TUNNEL.md) for internet access
- [Configure monitoring](MONITORING.md) with Grafana Cloud
- Set up automated backups for the database
