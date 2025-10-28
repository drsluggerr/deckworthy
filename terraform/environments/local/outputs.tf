output "namespace" {
  description = "The namespace where Deckworthy is deployed"
  value       = module.deckworthy.namespace
}

output "service_name" {
  description = "The name of the Deckworthy service"
  value       = module.deckworthy.service_name
}

output "ingress_host" {
  description = "The hostname for accessing Deckworthy"
  value       = module.deckworthy.ingress_host
}

output "deployment_name" {
  description = "The name of the Deckworthy deployment"
  value       = module.deckworthy.deployment_name
}

output "access_instructions" {
  description = "Instructions for accessing Deckworthy"
  value       = <<-EOT
    Deckworthy has been deployed!

    Access the application:
    - Add '127.0.0.1 ${module.deckworthy.ingress_host}' to your /etc/hosts file
    - Visit http://${module.deckworthy.ingress_host} in your browser

    Useful commands:
    - View pods: kubectl get pods -n ${module.deckworthy.namespace}
    - View logs: kubectl logs -n ${module.deckworthy.namespace} -l app=deckworthy
    - View cronjobs: kubectl get cronjobs -n ${module.deckworthy.namespace}
  EOT
}
