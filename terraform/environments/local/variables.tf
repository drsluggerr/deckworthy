variable "kubeconfig_path" {
  description = "Path to kubeconfig file"
  type        = string
  default     = "~/.kube/config"
}

variable "namespace" {
  description = "Kubernetes namespace for Deckworthy"
  type        = string
  default     = "deckworthy"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "local"
}

variable "image" {
  description = "Docker image for Deckworthy"
  type        = string
  default     = "deckworthy:latest"
}

variable "storage_size" {
  description = "Size of persistent volume for database"
  type        = string
  default     = "5Gi"
}

variable "storage_class" {
  description = "Storage class for persistent volume"
  type        = string
  default     = "local-path"
}

variable "cors_origins" {
  description = "CORS allowed origins"
  type        = string
  default     = "http://localhost:3000"
}

variable "steam_api_key" {
  description = "Steam API key"
  type        = string
  sensitive   = true
}

variable "itad_api_key" {
  description = "IsThereAnyDeal API key"
  type        = string
  sensitive   = true
}

variable "sync_prices_schedule" {
  description = "Cron schedule for price sync"
  type        = string
  default     = "0 */6 * * *"
}

variable "sync_protondb_schedule" {
  description = "Cron schedule for ProtonDB sync"
  type        = string
  default     = "0 2 * * *"
}

variable "sync_games_schedule" {
  description = "Cron schedule for games sync"
  type        = string
  default     = "0 3 * * 0"
}

variable "ingress_host" {
  description = "Hostname for ingress"
  type        = string
  default     = "deckworthy.local"
}

variable "enable_tls" {
  description = "Enable TLS for ingress"
  type        = bool
  default     = false
}

variable "tls_secret_name" {
  description = "Secret name for TLS certificate"
  type        = string
  default     = "deckworthy-tls"
}

variable "resources_requests_cpu" {
  description = "CPU request for deployment"
  type        = string
  default     = "100m"
}

variable "resources_requests_memory" {
  description = "Memory request for deployment"
  type        = string
  default     = "256Mi"
}

variable "resources_limits_cpu" {
  description = "CPU limit for deployment"
  type        = string
  default     = "500m"
}

variable "resources_limits_memory" {
  description = "Memory limit for deployment"
  type        = string
  default     = "512Mi"
}
