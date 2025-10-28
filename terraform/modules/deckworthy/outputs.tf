output "namespace" {
  description = "The namespace where Deckworthy is deployed"
  value       = kubernetes_namespace.deckworthy.metadata[0].name
}

output "service_name" {
  description = "The name of the Deckworthy service"
  value       = kubernetes_service.deckworthy.metadata[0].name
}

output "ingress_host" {
  description = "The hostname for accessing Deckworthy"
  value       = var.ingress_host
}

output "deployment_name" {
  description = "The name of the Deckworthy deployment"
  value       = kubernetes_deployment.deckworthy.metadata[0].name
}
