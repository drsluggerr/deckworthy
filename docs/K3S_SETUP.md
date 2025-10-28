# k3s Setup Guide

This guide covers installing k3s on various platforms for self-hosting Deckworthy.

## What is k3s?

k3s is a lightweight Kubernetes distribution perfect for:
- Edge computing
- IoT devices
- Development environments
- Self-hosted applications
- Learning Kubernetes

**Key Benefits:**
- Small footprint (~512MB RAM vs 2GB+ for full K8s)
- Single binary installation
- Production-ready
- 100% Kubernetes API compatible
- Works on ARM (Raspberry Pi) and x86_64

## Hardware Requirements

### Minimum (Works)
- 1 CPU core
- 512MB RAM
- 10GB storage
- Any modern Linux distro

### Recommended
- 2+ CPU cores
- 2GB+ RAM
- 20GB+ storage
- SSD for better performance

### Tested Platforms
- Raspberry Pi 4/5 (4GB+ RAM recommended)
- Old laptops/desktops
- Mini PCs (Intel N100, etc.)
- Cloud VMs (if you want to learn without AWS costs)
- WSL2 (Windows)

## Installation

### Linux (Ubuntu/Debian)

```bash
# Install k3s with default settings
curl -sfL https://get.k3s.io | sh -

# Check status
sudo systemctl status k3s

# Get kubeconfig
sudo cat /etc/rancher/k3s/k3s.yaml

# Copy to standard location (optional)
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $USER:$USER ~/.kube/config
chmod 600 ~/.kube/config

# Verify installation
kubectl get nodes
```

### Raspberry Pi (Raspberry Pi OS)

```bash
# Enable cgroups (required for k3s)
sudo sed -i '$ s/$/ cgroup_memory=1 cgroup_enable=memory/' /boot/cmdline.txt

# Reboot
sudo reboot

# Install k3s
curl -sfL https://get.k3s.io | sh -

# Wait for node to be ready
sudo k3s kubectl get nodes
```

### Using a Specific Version

```bash
# Install specific k3s version
curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=v1.28.5+k3s1 sh -
```

### Installation Options

```bash
# Install without Traefik (if you want to use another ingress controller)
curl -sfL https://get.k3s.io | sh -s - --disable traefik

# Install without ServiceLB (if you have your own load balancer)
curl -sfL https://get.k3s.io | sh -s - --disable servicelb

# Install with custom data directory
curl -sfL https://get.k3s.io | sh -s - --data-dir /mnt/k3s-data
```

## Post-Installation Setup

### 1. Install kubectl (if not already installed)

```bash
# Linux
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Verify
kubectl version --client
```

### 2. Configure kubectl Context

```bash
# k3s uses /etc/rancher/k3s/k3s.yaml by default
# Option 1: Use k3s directly
sudo k3s kubectl get nodes

# Option 2: Copy to standard location
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $USER:$USER ~/.kube/config

# Verify
kubectl get nodes
```

### 3. Test the Cluster

```bash
# Check nodes
kubectl get nodes

# Check system pods
kubectl get pods -n kube-system

# Check storage class (local-path should be available)
kubectl get storageclass
```

## Multi-Node Cluster (Optional)

### Server Node (Master)

```bash
# Install server with token
curl -sfL https://get.k3s.io | K3S_TOKEN=mysecrettoken sh -s - server

# Get server IP
ip addr show
```

### Agent Nodes (Workers)

```bash
# Install agent
curl -sfL https://get.k3s.io | K3S_URL=https://server-ip:6443 K3S_TOKEN=mysecrettoken sh -

# Verify from server
sudo k3s kubectl get nodes
```

## Useful Commands

### Cluster Management

```bash
# Check cluster status
kubectl cluster-info

# View nodes
kubectl get nodes

# View all resources
kubectl get all --all-namespaces

# Check k3s logs
sudo journalctl -u k3s -f
```

### k3s Service Management

```bash
# Start k3s
sudo systemctl start k3s

# Stop k3s
sudo systemctl stop k3s

# Restart k3s
sudo systemctl restart k3s

# Enable on boot
sudo systemctl enable k3s

# Check status
sudo systemctl status k3s
```

### Resource Monitoring

```bash
# Node resources
kubectl top nodes

# Pod resources
kubectl top pods --all-namespaces

# Describe node
kubectl describe node <node-name>
```

## Troubleshooting

### k3s Won't Start

```bash
# Check logs
sudo journalctl -u k3s -xe

# Check if port 6443 is in use
sudo netstat -tulpn | grep 6443

# Clean install
/usr/local/bin/k3s-uninstall.sh
curl -sfL https://get.k3s.io | sh -
```

### Permission Denied with kubectl

```bash
# Fix kubeconfig permissions
sudo chown $USER:$USER ~/.kube/config
chmod 600 ~/.kube/config
```

### Pods Stuck in Pending

```bash
# Check pod events
kubectl describe pod <pod-name> -n <namespace>

# Check node resources
kubectl top nodes

# Check storage
kubectl get pv,pvc --all-namespaces
```

### Storage Issues

```bash
# Check local-path provisioner
kubectl get pods -n kube-system | grep local-path

# Check local-path config
kubectl get configmap -n kube-system local-path-config -o yaml
```

## Uninstalling k3s

```bash
# Server/single-node
sudo /usr/local/bin/k3s-uninstall.sh

# Agent node
sudo /usr/local/bin/k3s-agent-uninstall.sh
```

## Performance Tuning

### For Low-Memory Systems (< 2GB RAM)

```bash
# Install with reduced memory footprint
curl -sfL https://get.k3s.io | sh -s - \
  --kubelet-arg="kube-api-qps=10" \
  --kubelet-arg="kube-api-burst=20"
```

### For Better I/O Performance

```bash
# Use SSD/NVMe for data directory
curl -sfL https://get.k3s.io | sh -s - --data-dir /mnt/ssd/k3s-data
```

### For Raspberry Pi Optimization

```bash
# Install with optimizations
curl -sfL https://get.k3s.io | sh -s - \
  --disable=traefik \
  --kubelet-arg="max-pods=50" \
  --kube-proxy-arg="metrics-bind-address=0.0.0.0:10249"
```

## Security Considerations

### Firewall Configuration

```bash
# Required ports for k3s
# Server: 6443 (API), 10250 (kubelet)
# Allow from your IP or local network

# Example: ufw
sudo ufw allow 6443/tcp
sudo ufw allow 10250/tcp
sudo ufw allow from 192.168.1.0/24 to any port 6443
```

### Secure Kubeconfig

```bash
# Don't expose kubeconfig
chmod 600 ~/.kube/config

# Use RBAC for access control
kubectl create serviceaccount my-user
kubectl create rolebinding my-user-binding --role=edit --serviceaccount=default:my-user
```

## Next Steps

1. **Deploy Deckworthy**: Follow [KUBERNETES_DEPLOYMENT.md](KUBERNETES_DEPLOYMENT.md)
2. **Expose to Internet**: Follow [CLOUDFLARE_TUNNEL.md](CLOUDFLARE_TUNNEL.md)
3. **Set up Monitoring**: Follow [MONITORING.md](MONITORING.md)

## Additional Resources

- [k3s Official Docs](https://docs.k3s.io/)
- [k3s GitHub](https://github.com/k3s-io/k3s)
- [Kubernetes Docs](https://kubernetes.io/docs/)
