# Monitoring Guide

Set up monitoring for your Deckworthy Kubernetes deployment using Grafana Cloud's free tier.

## Why Grafana Cloud?

**Benefits:**
- **Free tier:** 10,000 series, 50GB logs, 50GB traces
- **Managed service:** No maintenance required
- **Prometheus + Grafana:** Industry standard tools
- **Pre-built dashboards:** Kubernetes monitoring out of the box
- **Alerts:** Email/Slack notifications
- **Perfect for personal projects**

**Alternatives:**
- Self-hosted Prometheus + Grafana (uses cluster resources)
- CloudWatch Container Insights (AWS only, costs money)
- Datadog (expensive)

## Setup Grafana Cloud (Free Tier)

### 1. Create Account

1. Go to https://grafana.com/auth/sign-up/create-user
2. Sign up for free account
3. Choose "Free" plan
4. Verify email

### 2. Get API Keys

1. Go to your Grafana Cloud portal
2. Click "My Account" → "Cloud Access Policies"
3. Create a new access policy:
   - **Name:** deckworthy-metrics
   - **Scopes:** metrics:write, logs:write
4. Create a token and save it (you won't see it again)

### 3. Get Connection Info

In your Grafana Cloud portal:
1. Go to "Connections" → "Add Integration"
2. Search for "Kubernetes"
3. Note down these values:
   - **Prometheus Remote Write URL**
   - **Loki Push URL**
   - **Instance ID**

Example:
```
Prometheus URL: https://prometheus-prod-01-eu-west-0.grafana.net/api/prom/push
Loki URL: https://logs-prod-eu-west-0.grafana.net/loki/api/v1/push
Instance ID: 123456
```

## Install Grafana Agent on k3s

Grafana Agent collects metrics and logs from your cluster and sends them to Grafana Cloud.

### 1. Create Namespace

```bash
kubectl create namespace grafana-agent
```

### 2. Create Secret with Credentials

```bash
kubectl create secret generic grafana-agent-credentials \
  --from-literal=username=123456 \
  --from-literal=password=YOUR_ACCESS_TOKEN \
  -n grafana-agent
```

Replace:
- `123456` with your Instance ID
- `YOUR_ACCESS_TOKEN` with the token you created

### 3. Create ConfigMap

Create `grafana-agent-config.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-agent-config
  namespace: grafana-agent
data:
  agent.yaml: |
    server:
      log_level: info

    metrics:
      global:
        scrape_interval: 60s
        remote_write:
        - url: https://prometheus-prod-01-eu-west-0.grafana.net/api/prom/push
          basic_auth:
            username: ${PROMETHEUS_USERNAME}
            password: ${PROMETHEUS_PASSWORD}

      configs:
      - name: default
        scrape_configs:
        # Scrape Kubernetes API server
        - job_name: 'kubernetes-apiservers'
          kubernetes_sd_configs:
          - role: endpoints
          scheme: https
          tls_config:
            ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
          bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
          relabel_configs:
          - source_labels: [__meta_kubernetes_namespace, __meta_kubernetes_service_name, __meta_kubernetes_endpoint_port_name]
            action: keep
            regex: default;kubernetes;https

        # Scrape Kubelet
        - job_name: 'kubernetes-nodes'
          kubernetes_sd_configs:
          - role: node
          scheme: https
          tls_config:
            ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
          bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
          relabel_configs:
          - action: labelmap
            regex: __meta_kubernetes_node_label_(.+)

        # Scrape pods
        - job_name: 'kubernetes-pods'
          kubernetes_sd_configs:
          - role: pod
          relabel_configs:
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
            action: keep
            regex: true
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
            action: replace
            target_label: __metrics_path__
            regex: (.+)
          - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
            action: replace
            regex: ([^:]+)(?::\d+)?;(\d+)
            replacement: $1:$2
            target_label: __address__
          - action: labelmap
            regex: __meta_kubernetes_pod_label_(.+)
          - source_labels: [__meta_kubernetes_namespace]
            action: replace
            target_label: namespace
          - source_labels: [__meta_kubernetes_pod_name]
            action: replace
            target_label: pod

    logs:
      configs:
      - name: default
        clients:
        - url: https://logs-prod-eu-west-0.grafana.net/loki/api/v1/push
          basic_auth:
            username: ${LOKI_USERNAME}
            password: ${LOKI_PASSWORD}

        positions:
          filename: /tmp/positions.yaml

        scrape_configs:
        # Scrape pod logs
        - job_name: kubernetes-pods
          kubernetes_sd_configs:
          - role: pod
          relabel_configs:
          - source_labels: [__meta_kubernetes_pod_node_name]
            target_label: __host__
          - action: labelmap
            regex: __meta_kubernetes_pod_label_(.+)
          - action: replace
            source_labels:
            - __meta_kubernetes_namespace
            target_label: namespace
          - action: replace
            source_labels:
            - __meta_kubernetes_pod_name
            target_label: pod
          - action: replace
            source_labels:
            - __meta_kubernetes_container_name
            target_label: container
          - replacement: /var/log/pods/*$1/*.log
            separator: /
            source_labels:
            - __meta_kubernetes_pod_uid
            - __meta_kubernetes_pod_container_name
            target_label: __path__
```

**Update URLs:**
- Replace Prometheus URL with your endpoint
- Replace Loki URL with your endpoint

Apply:

```bash
kubectl apply -f grafana-agent-config.yaml
```

### 4. Deploy Grafana Agent

Create `grafana-agent-deployment.yaml`:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: grafana-agent
  namespace: grafana-agent
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: grafana-agent
rules:
- apiGroups: [""]
  resources:
  - nodes
  - nodes/proxy
  - services
  - endpoints
  - pods
  verbs: ["get", "list", "watch"]
- nonResourceURLs:
  - /metrics
  verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: grafana-agent
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: grafana-agent
subjects:
- kind: ServiceAccount
  name: grafana-agent
  namespace: grafana-agent
---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: grafana-agent
  namespace: grafana-agent
spec:
  selector:
    matchLabels:
      app: grafana-agent
  template:
    metadata:
      labels:
        app: grafana-agent
    spec:
      serviceAccountName: grafana-agent
      containers:
      - name: agent
        image: grafana/agent:latest
        args:
        - -config.file=/etc/agent/agent.yaml
        - -enable-features=integrations-next
        env:
        - name: HOSTNAME
          valueFrom:
            fieldRef:
              fieldPath: spec.nodeName
        - name: PROMETHEUS_USERNAME
          valueFrom:
            secretKeyRef:
              name: grafana-agent-credentials
              key: username
        - name: PROMETHEUS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: grafana-agent-credentials
              key: password
        - name: LOKI_USERNAME
          valueFrom:
            secretKeyRef:
              name: grafana-agent-credentials
              key: username
        - name: LOKI_PASSWORD
          valueFrom:
            secretKeyRef:
              name: grafana-agent-credentials
              key: password
        volumeMounts:
        - name: config
          mountPath: /etc/agent
        - name: varlog
          mountPath: /var/log
          readOnly: true
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
        resources:
          requests:
            cpu: 50m
            memory: 128Mi
          limits:
            cpu: 200m
            memory: 256Mi
      volumes:
      - name: config
        configMap:
          name: grafana-agent-config
      - name: varlog
        hostPath:
          path: /var/log
      - name: varlibdockercontainers
        hostPath:
          path: /var/lib/docker/containers
```

Apply:

```bash
kubectl apply -f grafana-agent-deployment.yaml
```

### 5. Verify Agent is Running

```bash
# Check pods
kubectl get pods -n grafana-agent

# Check logs
kubectl logs -n grafana-agent -l app=grafana-agent

# Should see "Grafana Agent started" and metrics being sent
```

## Access Grafana Dashboards

### 1. Login to Grafana Cloud

Go to your Grafana Cloud URL (e.g., `https://yourcompany.grafana.net`)

### 2. Import Kubernetes Dashboards

1. Click "+" → "Import"
2. Import these dashboard IDs:
   - **315** - Kubernetes cluster monitoring
   - **12114** - Kubernetes Deployment monitoring
   - **13332** - Kubernetes Pods monitoring
   - **14623** - Kubernetes Cluster Metrics

3. Select your Prometheus data source

### 3. Create Deckworthy Dashboard

Create custom dashboard for Deckworthy:

1. Click "+" → "Dashboard"
2. Add panels for:
   - Pod CPU/Memory usage
   - Request rate
   - Response times
   - Database size
   - CronJob success/failure

## Set Up Alerts

### 1. Create Alert Rules

Example alert for pod down:

```yaml
apiVersion: 1
groups:
  - name: deckworthy-alerts
    interval: 1m
    rules:
      - alert: DeckworthyPodDown
        expr: up{namespace="deckworthy"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Deckworthy pod is down"
          description: "Deckworthy pod has been down for more than 5 minutes"

      - alert: HighMemoryUsage
        expr: container_memory_usage_bytes{namespace="deckworthy"} / container_spec_memory_limit_bytes{namespace="deckworthy"} > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Deckworthy is using more than 90% of allocated memory"

      - alert: CronJobFailed
        expr: kube_job_status_failed{namespace="deckworthy"} > 0
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "CronJob failed"
          description: "A Deckworthy sync job has failed"
```

### 2. Configure Notification Channels

1. Go to Alerting → Contact points
2. Add contact point (Email, Slack, Discord, etc.)
3. Test notification

### 3. Create Alert Rules

1. Go to Alerting → Alert rules
2. Create new alert rule
3. Set conditions and thresholds
4. Assign notification channel

## Useful Queries

### Pod Metrics

```promql
# CPU usage
rate(container_cpu_usage_seconds_total{namespace="deckworthy"}[5m])

# Memory usage
container_memory_usage_bytes{namespace="deckworthy"}

# Network traffic
rate(container_network_transmit_bytes_total{namespace="deckworthy"}[5m])
```

### Application Metrics

```promql
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m])

# Request duration
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

### CronJob Metrics

```promql
# Failed jobs
kube_job_status_failed{namespace="deckworthy"}

# Job duration
kube_job_status_completion_time - kube_job_status_start_time
```

## Alternative: Self-Hosted Prometheus + Grafana

If you prefer self-hosted:

```bash
# Install kube-prometheus-stack with Helm
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace

# Access Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80

# Default credentials: admin / prom-operator
```

## Troubleshooting

### Metrics Not Showing Up

```bash
# Check agent logs
kubectl logs -n grafana-agent -l app=grafana-agent

# Verify connectivity
kubectl exec -n grafana-agent -it $(kubectl get pod -n grafana-agent -l app=grafana-agent -o jsonpath='{.items[0].metadata.name}') -- wget -O- https://prometheus-prod-01-eu-west-0.grafana.net
```

### High Cardinality Warning

Reduce metric labels or increase scrape interval:

```yaml
metrics:
  global:
    scrape_interval: 120s  # Increase from 60s
```

## Cost Management

**Grafana Cloud Free Tier:**
- 10,000 metric series
- 50GB logs per month
- 50GB traces per month

**Tips to stay within free tier:**
- Increase scrape interval
- Reduce log retention
- Filter unnecessary metrics
- Use metric relabeling

## Next Steps

- Set up custom dashboards for Deckworthy
- Configure alerts for critical metrics
- Set up log aggregation for debugging
- Monitor resource usage trends

## Resources

- [Grafana Cloud Docs](https://grafana.com/docs/grafana-cloud/)
- [Grafana Agent Docs](https://grafana.com/docs/agent/latest/)
- [Prometheus Query Basics](https://prometheus.io/docs/prometheus/latest/querying/basics/)
