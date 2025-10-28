# Terraform Configuration

Infrastructure as Code for deploying Deckworthy to Kubernetes using Terraform.

## Directory Structure

```
terraform/
├── modules/
│   └── deckworthy/           # Reusable Deckworthy module
│       ├── main.tf           # Main resource definitions
│       ├── variables.tf      # Input variables
│       └── outputs.tf        # Output values
│
└── environments/
    └── local/                # Local k3s environment
        ├── main.tf           # Environment configuration
        ├── variables.tf      # Environment variables
        ├── outputs.tf        # Environment outputs
        └── terraform.tfvars.example  # Example variables file
```

## Prerequisites

- Terraform >= 1.0
- kubectl configured with cluster access
- Docker image built (deckworthy:latest)
- API keys (Steam, IsThereAnyDeal)

## Quick Start

### 1. Install Terraform

```bash
# Linux (Ubuntu/Debian)
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform

# macOS
brew install terraform

# Windows
choco install terraform

# Verify
terraform version
```

### 2. Configure Environment

```bash
cd terraform/environments/local

# Copy example vars
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars
```

**Required values in `terraform.tfvars`:**
```hcl
steam_api_key = "your-steam-api-key"
itad_api_key  = "your-itad-api-key"
```

### 3. Initialize Terraform

```bash
terraform init
```

### 4. Plan Deployment

```bash
# Preview changes
terraform plan

# Save plan to file
terraform plan -out=tfplan
```

### 5. Deploy

```bash
terraform apply

# Or apply saved plan
terraform apply tfplan
```

### 6. Verify

```bash
# View outputs
terraform output

# Check Kubernetes resources
kubectl get all -n deckworthy
```

## Module: deckworthy

The `deckworthy` module creates all necessary Kubernetes resources:

### Resources Created

- **Namespace:** deckworthy
- **ConfigMap:** Application configuration
- **Secret:** API keys (encrypted)
- **PersistentVolumeClaim:** Database storage
- **Deployment:** Application pods
- **Service:** ClusterIP service
- **Ingress:** HTTP routing
- **CronJobs:** Sync jobs (games, protondb, prices)

### Module Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `namespace` | Kubernetes namespace | `deckworthy` |
| `environment` | Environment name | `production` |
| `image` | Docker image | `deckworthy:latest` |
| `replicas` | Number of replicas | `1` |
| `storage_size` | PVC storage size | `5Gi` |
| `storage_class` | Storage class | `local-path` |
| `cors_origins` | CORS origins | `http://localhost:3000` |
| `steam_api_key` | Steam API key | (required) |
| `itad_api_key` | ITAD API key | (required) |
| `ingress_host` | Ingress hostname | `deckworthy.local` |
| `enable_tls` | Enable TLS | `false` |

See [modules/deckworthy/variables.tf](modules/deckworthy/variables.tf) for all options.

### Module Outputs

| Output | Description |
|--------|-------------|
| `namespace` | Deployed namespace |
| `service_name` | Service name |
| `ingress_host` | Access hostname |
| `deployment_name` | Deployment name |

## Environment: local

Configuration for deploying to local k3s cluster.

### Configuration

Edit `terraform.tfvars`:

```hcl
# Kubernetes config
kubeconfig_path = "~/.kube/config"
namespace       = "deckworthy"
environment     = "local"

# Docker image
image = "deckworthy:latest"

# API Keys (required)
steam_api_key = "your-steam-api-key"
itad_api_key  = "your-itad-api-key"

# Ingress
ingress_host = "deckworthy.local"
cors_origins = "http://localhost:3000,http://deckworthy.local"

# Resources (adjust for your server)
resources_requests_cpu    = "100m"
resources_requests_memory = "256Mi"
resources_limits_cpu      = "500m"
resources_limits_memory   = "512Mi"

# Storage
storage_size = "5Gi"

# Sync schedules
sync_prices_schedule   = "0 */6 * * *"  # Every 6 hours
sync_protondb_schedule = "0 2 * * *"    # Daily at 2am
sync_games_schedule    = "0 3 * * 0"    # Weekly Sunday 3am
```

## Managing State

### Local State (Default)

State is stored in `terraform.tfstate` locally.

**Backup state:**
```bash
cp terraform.tfstate terraform.tfstate.backup
```

### Remote State (Recommended for Production)

Use S3, Terraform Cloud, or similar:

```hcl
terraform {
  backend "s3" {
    bucket = "my-terraform-state"
    key    = "deckworthy/terraform.tfstate"
    region = "us-east-1"
  }
}
```

## Common Operations

### Update Configuration

```bash
# Edit variables
nano terraform.tfvars

# Apply changes
terraform apply
```

### Update Image

```bash
# Update image variable
echo 'image = "deckworthy:v1.1"' >> terraform.tfvars

# Apply
terraform apply
```

### Scale Resources

```bash
# Edit resources in terraform.tfvars
resources_limits_cpu = "1000m"
resources_limits_memory = "1Gi"

# Apply
terraform apply
```

### Destroy Resources

```bash
# Destroy everything
terraform destroy

# Destroy specific resource
terraform destroy -target=module.deckworthy.kubernetes_deployment.deckworthy
```

## Multi-Environment Setup

Create additional environments:

```bash
# Copy local environment
cp -r environments/local environments/prod

# Update values for production
cd environments/prod
nano terraform.tfvars
```

Switch between environments:
```bash
cd environments/local
terraform apply

cd ../prod
terraform apply
```

## Terraform Outputs

After deployment, view helpful information:

```bash
# View all outputs
terraform output

# Specific output
terraform output ingress_host

# JSON format
terraform output -json
```

## Troubleshooting

### "Error: Kubernetes cluster unreachable"

```bash
# Verify kubectl works
kubectl get nodes

# Check kubeconfig path
export KUBECONFIG=~/.kube/config

# Update terraform.tfvars
kubeconfig_path = "/correct/path/to/kubeconfig"
```

### "Error: Secret already exists"

```bash
# Import existing resource
terraform import module.deckworthy.kubernetes_secret.deckworthy deckworthy/deckworthy-secrets

# Or delete and recreate
kubectl delete secret -n deckworthy deckworthy-secrets
terraform apply
```

### State Lock

```bash
# Force unlock (use carefully)
terraform force-unlock <lock-id>
```

### Plan Shows Unexpected Changes

```bash
# Refresh state
terraform refresh

# View detailed diff
terraform plan -detailed-exitcode
```

## Advanced Usage

### Import Existing Resources

```bash
# Import namespace
terraform import module.deckworthy.kubernetes_namespace.deckworthy deckworthy

# Import deployment
terraform import module.deckworthy.kubernetes_deployment.deckworthy deckworthy/deckworthy
```

### Use Different Storage Class

For AWS EKS:
```hcl
storage_class = "gp3"
```

For GKE:
```hcl
storage_class = "standard-rwo"
```

### Enable TLS

```hcl
enable_tls      = true
tls_secret_name = "deckworthy-tls"
```

Requires cert-manager or manual certificate creation.

### Custom Sync Schedules

```hcl
sync_prices_schedule   = "0 */12 * * *"  # Every 12 hours
sync_protondb_schedule = "0 1 * * *"     # Daily at 1am
sync_games_schedule    = "0 4 * * 1"     # Weekly Monday 4am
```

## Validation

### Validate Configuration

```bash
terraform validate
```

### Format Code

```bash
terraform fmt -recursive
```

### Check for Security Issues

```bash
# Install tfsec
brew install tfsec

# Scan for issues
tfsec .
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to k3s

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3

    - name: Setup Terraform
      uses: hashicorp/setup-terraform@v2

    - name: Terraform Init
      run: terraform init
      working-directory: terraform/environments/local

    - name: Terraform Apply
      run: terraform apply -auto-approve
      working-directory: terraform/environments/local
      env:
        TF_VAR_steam_api_key: ${{ secrets.STEAM_API_KEY }}
        TF_VAR_itad_api_key: ${{ secrets.ITAD_API_KEY }}
```

## Documentation

- [K3S Setup](../docs/K3S_SETUP.md)
- [Kubernetes Deployment](../docs/KUBERNETES_DEPLOYMENT.md)
- [Terraform Docs](https://www.terraform.io/docs)

## Resources

- [Terraform Kubernetes Provider](https://registry.terraform.io/providers/hashicorp/kubernetes/latest/docs)
- [Terraform Best Practices](https://www.terraform-best-practices.com/)
- [k3s Documentation](https://docs.k3s.io/)
