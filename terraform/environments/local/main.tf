terraform {
  required_version = ">= 1.0"

  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
}

# Provider configuration for local k3s cluster
# k3s stores kubeconfig at /etc/rancher/k3s/k3s.yaml by default
provider "kubernetes" {
  config_path = var.kubeconfig_path
}

# Use the Deckworthy module
module "deckworthy" {
  source = "../../modules/deckworthy"

  namespace   = var.namespace
  environment = var.environment

  # Docker image configuration
  image = var.image

  # Storage configuration
  storage_size  = var.storage_size
  storage_class = var.storage_class

  # Application configuration
  cors_origins = var.cors_origins

  # API Keys
  steam_api_key = var.steam_api_key
  itad_api_key  = var.itad_api_key

  # Sync schedules
  sync_prices_schedule   = var.sync_prices_schedule
  sync_protondb_schedule = var.sync_protondb_schedule
  sync_games_schedule    = var.sync_games_schedule

  # Ingress configuration
  ingress_host    = var.ingress_host
  enable_tls      = var.enable_tls
  tls_secret_name = var.tls_secret_name

  # Resource limits
  resources_requests_cpu    = var.resources_requests_cpu
  resources_requests_memory = var.resources_requests_memory
  resources_limits_cpu      = var.resources_limits_cpu
  resources_limits_memory   = var.resources_limits_memory
}
