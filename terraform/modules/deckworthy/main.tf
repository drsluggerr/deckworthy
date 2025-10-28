terraform {
  required_version = ">= 1.0"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
}

# Namespace
resource "kubernetes_namespace" "deckworthy" {
  metadata {
    name = var.namespace
    labels = {
      app         = "deckworthy"
      environment = var.environment
    }
  }
}

# ConfigMap
resource "kubernetes_config_map" "deckworthy" {
  metadata {
    name      = "deckworthy-config"
    namespace = kubernetes_namespace.deckworthy.metadata[0].name
    labels = {
      app = "deckworthy"
    }
  }

  data = {
    NODE_ENV                = "production"
    PORT                    = "3000"
    DATABASE_PATH           = "/app/data/deckworthy.db"
    CORS_ORIGINS            = var.cors_origins
    SYNC_PRICES_SCHEDULE    = var.sync_prices_schedule
    SYNC_PROTONDB_SCHEDULE  = var.sync_protondb_schedule
    SYNC_GAMES_SCHEDULE     = var.sync_games_schedule
  }
}

# Secret
resource "kubernetes_secret" "deckworthy" {
  metadata {
    name      = "deckworthy-secrets"
    namespace = kubernetes_namespace.deckworthy.metadata[0].name
    labels = {
      app = "deckworthy"
    }
  }

  data = {
    STEAM_API_KEY = var.steam_api_key
    ITAD_API_KEY  = var.itad_api_key
  }

  type = "Opaque"
}

# Persistent Volume Claim
resource "kubernetes_persistent_volume_claim" "deckworthy" {
  metadata {
    name      = "deckworthy-data"
    namespace = kubernetes_namespace.deckworthy.metadata[0].name
    labels = {
      app = "deckworthy"
    }
  }

  spec {
    access_modes       = ["ReadWriteOnce"]
    storage_class_name = var.storage_class

    resources {
      requests = {
        storage = var.storage_size
      }
    }
  }
}

# Deployment
resource "kubernetes_deployment" "deckworthy" {
  metadata {
    name      = "deckworthy"
    namespace = kubernetes_namespace.deckworthy.metadata[0].name
    labels = {
      app = "deckworthy"
    }
  }

  spec {
    replicas = var.replicas

    strategy {
      type = "Recreate"  # Required for ReadWriteOnce volumes
    }

    selector {
      match_labels = {
        app = "deckworthy"
      }
    }

    template {
      metadata {
        labels = {
          app = "deckworthy"
        }
      }

      spec {
        security_context {
          fs_group        = 1001
          run_as_user     = 1001
          run_as_non_root = true
        }

        container {
          name              = "deckworthy"
          image             = var.image
          image_pull_policy = "IfNotPresent"

          port {
            container_port = 3000
            name           = "http"
            protocol       = "TCP"
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.deckworthy.metadata[0].name
            }
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.deckworthy.metadata[0].name
            }
          }

          volume_mount {
            name       = "data"
            mount_path = "/app/data"
          }

          resources {
            requests = {
              cpu    = var.resources_requests_cpu
              memory = var.resources_requests_memory
            }
            limits = {
              cpu    = var.resources_limits_cpu
              memory = var.resources_limits_memory
            }
          }

          liveness_probe {
            http_get {
              path = "/api/stats"
              port = "http"
            }
            initial_delay_seconds = 30
            period_seconds        = 30
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/api/stats"
              port = "http"
            }
            initial_delay_seconds = 10
            period_seconds        = 10
            timeout_seconds       = 3
            failure_threshold     = 3
          }

          startup_probe {
            http_get {
              path = "/api/stats"
              port = "http"
            }
            initial_delay_seconds = 10
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 30
          }
        }

        volume {
          name = "data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.deckworthy.metadata[0].name
          }
        }

        restart_policy = "Always"
      }
    }
  }
}

# Service
resource "kubernetes_service" "deckworthy" {
  metadata {
    name      = "deckworthy"
    namespace = kubernetes_namespace.deckworthy.metadata[0].name
    labels = {
      app = "deckworthy"
    }
  }

  spec {
    type = "ClusterIP"

    selector = {
      app = "deckworthy"
    }

    port {
      port        = 80
      target_port = "http"
      protocol    = "TCP"
      name        = "http"
    }

    session_affinity = "None"
  }
}

# Ingress
resource "kubernetes_ingress_v1" "deckworthy" {
  metadata {
    name      = "deckworthy"
    namespace = kubernetes_namespace.deckworthy.metadata[0].name
    labels = {
      app = "deckworthy"
    }
  }

  spec {
    dynamic "tls" {
      for_each = var.enable_tls ? [1] : []
      content {
        hosts       = [var.ingress_host]
        secret_name = var.tls_secret_name
      }
    }

    rule {
      host = var.ingress_host

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.deckworthy.metadata[0].name
              port {
                number = 80
              }
            }
          }
        }
      }
    }
  }
}

# CronJob: Sync Games
resource "kubernetes_cron_job_v1" "sync_games" {
  metadata {
    name      = "sync-games"
    namespace = kubernetes_namespace.deckworthy.metadata[0].name
    labels = {
      app = "deckworthy"
      job = "sync-games"
    }
  }

  spec {
    schedule                      = var.sync_games_schedule
    timezone                      = "UTC"
    concurrency_policy            = "Forbid"
    successful_jobs_history_limit = 3
    failed_jobs_history_limit     = 3

    job_template {
      metadata {
        labels = {
          app = "deckworthy"
          job = "sync-games"
        }
      }

      spec {
        backoff_limit              = 2
        active_deadline_seconds    = 3600

        template {
          metadata {
            labels = {
              app = "deckworthy"
              job = "sync-games"
            }
          }

          spec {
            restart_policy = "OnFailure"

            security_context {
              fs_group        = 1001
              run_as_user     = 1001
              run_as_non_root = true
            }

            container {
              name              = "sync-games"
              image             = var.image
              image_pull_policy = "IfNotPresent"
              command           = ["node", "dist/jobs/sync-games.js"]
              args              = ["1000"]

              env_from {
                config_map_ref {
                  name = kubernetes_config_map.deckworthy.metadata[0].name
                }
              }

              env_from {
                secret_ref {
                  name = kubernetes_secret.deckworthy.metadata[0].name
                }
              }

              volume_mount {
                name       = "data"
                mount_path = "/app/data"
              }

              resources {
                requests = {
                  cpu    = "50m"
                  memory = "128Mi"
                }
                limits = {
                  cpu    = "200m"
                  memory = "256Mi"
                }
              }
            }

            volume {
              name = "data"
              persistent_volume_claim {
                claim_name = kubernetes_persistent_volume_claim.deckworthy.metadata[0].name
              }
            }
          }
        }
      }
    }
  }
}

# CronJob: Sync ProtonDB
resource "kubernetes_cron_job_v1" "sync_protondb" {
  metadata {
    name      = "sync-protondb"
    namespace = kubernetes_namespace.deckworthy.metadata[0].name
    labels = {
      app = "deckworthy"
      job = "sync-protondb"
    }
  }

  spec {
    schedule                      = var.sync_protondb_schedule
    timezone                      = "UTC"
    concurrency_policy            = "Forbid"
    successful_jobs_history_limit = 3
    failed_jobs_history_limit     = 3

    job_template {
      metadata {
        labels = {
          app = "deckworthy"
          job = "sync-protondb"
        }
      }

      spec {
        backoff_limit              = 2
        active_deadline_seconds    = 3600

        template {
          metadata {
            labels = {
              app = "deckworthy"
              job = "sync-protondb"
            }
          }

          spec {
            restart_policy = "OnFailure"

            security_context {
              fs_group        = 1001
              run_as_user     = 1001
              run_as_non_root = true
            }

            container {
              name              = "sync-protondb"
              image             = var.image
              image_pull_policy = "IfNotPresent"
              command           = ["node", "dist/jobs/sync-protondb.js"]

              env_from {
                config_map_ref {
                  name = kubernetes_config_map.deckworthy.metadata[0].name
                }
              }

              env_from {
                secret_ref {
                  name = kubernetes_secret.deckworthy.metadata[0].name
                }
              }

              volume_mount {
                name       = "data"
                mount_path = "/app/data"
              }

              resources {
                requests = {
                  cpu    = "50m"
                  memory = "128Mi"
                }
                limits = {
                  cpu    = "200m"
                  memory = "256Mi"
                }
              }
            }

            volume {
              name = "data"
              persistent_volume_claim {
                claim_name = kubernetes_persistent_volume_claim.deckworthy.metadata[0].name
              }
            }
          }
        }
      }
    }
  }
}

# CronJob: Sync Prices
resource "kubernetes_cron_job_v1" "sync_prices" {
  metadata {
    name      = "sync-prices"
    namespace = kubernetes_namespace.deckworthy.metadata[0].name
    labels = {
      app = "deckworthy"
      job = "sync-prices"
    }
  }

  spec {
    schedule                      = var.sync_prices_schedule
    timezone                      = "UTC"
    concurrency_policy            = "Forbid"
    successful_jobs_history_limit = 3
    failed_jobs_history_limit     = 3

    job_template {
      metadata {
        labels = {
          app = "deckworthy"
          job = "sync-prices"
        }
      }

      spec {
        backoff_limit              = 2
        active_deadline_seconds    = 3600

        template {
          metadata {
            labels = {
              app = "deckworthy"
              job = "sync-prices"
            }
          }

          spec {
            restart_policy = "OnFailure"

            security_context {
              fs_group        = 1001
              run_as_user     = 1001
              run_as_non_root = true
            }

            container {
              name              = "sync-prices"
              image             = var.image
              image_pull_policy = "IfNotPresent"
              command           = ["node", "dist/jobs/sync-prices.js"]

              env_from {
                config_map_ref {
                  name = kubernetes_config_map.deckworthy.metadata[0].name
                }
              }

              env_from {
                secret_ref {
                  name = kubernetes_secret.deckworthy.metadata[0].name
                }
              }

              volume_mount {
                name       = "data"
                mount_path = "/app/data"
              }

              resources {
                requests = {
                  cpu    = "100m"
                  memory = "128Mi"
                }
                limits = {
                  cpu    = "300m"
                  memory = "256Mi"
                }
              }
            }

            volume {
              name = "data"
              persistent_volume_claim {
                claim_name = kubernetes_persistent_volume_claim.deckworthy.metadata[0].name
              }
            }
          }
        }
      }
    }
  }
}
