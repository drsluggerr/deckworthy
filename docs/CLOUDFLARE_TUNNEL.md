# CloudFlare Tunnel Setup Guide

Expose your self-hosted Deckworthy instance to the internet securely using CloudFlare Tunnel (formerly Argo Tunnel).

## Why CloudFlare Tunnel?

**Benefits:**
- **No port forwarding needed** - No router configuration required
- **Free forever** - No cost for personal projects
- **Automatic HTTPS** - SSL/TLS certificates handled automatically
- **DDoS protection** - CloudFlare's network protects your home IP
- **Custom domain** - Use your own domain name
- **Zero-trust security** - Built-in access controls
- **Hide your home IP** - CloudFlare proxies all traffic

**Perfect for:**
- Self-hosted applications
- Home servers
- Raspberry Pi projects
- Learning and development

## Prerequisites

- CloudFlare account (free)
- Domain name (optional, can use CloudFlare's free subdomain)
- Deckworthy running in k3s
- `cloudflared` installed

## Option 1: Quick Setup (Remotely Managed)

This is the easiest method, managed through CloudFlare dashboard.

### 1. Install cloudflared

```bash
# Linux (Ubuntu/Debian)
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# Linux (Generic)
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared

# macOS
brew install cloudflare/cloudflare/cloudflared

# Raspberry Pi (ARM64)
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64
sudo mv cloudflared-linux-arm64 /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared

# Verify
cloudflared --version
```

### 2. Authenticate

```bash
# Login to CloudFlare
cloudflared tunnel login

# This opens a browser to authorize
# Select your domain from the list
```

### 3. Create Tunnel

```bash
# Create a new tunnel
cloudflared tunnel create deckworthy

# Note the tunnel ID (shows as UUID)
# Example: 12345678-1234-1234-1234-123456789abc
```

### 4. Configure Tunnel

Create a config file:

```bash
# Create config directory
sudo mkdir -p /etc/cloudflared

# Create config file
sudo nano /etc/cloudflared/config.yml
```

Add this configuration:

```yaml
tunnel: deckworthy
credentials-file: /root/.cloudflared/12345678-1234-1234-1234-123456789abc.json

ingress:
  # Route your domain to Deckworthy service
  - hostname: deckworthy.yourdomain.com
    service: http://localhost:80
    originRequest:
      noTLSVerify: true

  # Catch-all rule (required)
  - service: http_status:404
```

**Update:**
- Replace tunnel ID in `credentials-file` with your actual tunnel ID
- Replace `deckworthy.yourdomain.com` with your desired hostname
- Update service URL if using different port

### 5. Create DNS Record

```bash
# Create DNS CNAME for your tunnel
cloudflared tunnel route dns deckworthy deckworthy.yourdomain.com
```

### 6. Run Tunnel as Service

```bash
# Install as system service
sudo cloudflared service install

# Start service
sudo systemctl start cloudflared

# Enable on boot
sudo systemctl enable cloudflared

# Check status
sudo systemctl status cloudflared

# View logs
sudo journalctl -u cloudflared -f
```

### 7. Test

Visit https://deckworthy.yourdomain.com (HTTPS automatically enabled!)

## Option 2: Kubernetes Deployment

Run cloudflared directly in your k3s cluster.

### 1. Get Tunnel Token

Create tunnel in CloudFlare dashboard:
1. Go to https://one.dash.cloudflare.com/
2. Navigate to Networks > Tunnels
3. Click "Create a tunnel"
4. Choose "Cloudflared"
5. Name it "deckworthy"
6. Copy the tunnel token (long string starting with `eyJ...`)

### 2. Create Kubernetes Secret

```bash
# Create secret with tunnel token
kubectl create secret generic cloudflare-tunnel \
  --from-literal=token=YOUR_TUNNEL_TOKEN_HERE \
  -n deckworthy
```

### 3. Deploy cloudflared

Create `cloudflared-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cloudflared
  namespace: deckworthy
spec:
  replicas: 2  # For redundancy
  selector:
    matchLabels:
      app: cloudflared
  template:
    metadata:
      labels:
        app: cloudflared
    spec:
      containers:
      - name: cloudflared
        image: cloudflare/cloudflared:latest
        args:
        - tunnel
        - --no-autoupdate
        - run
        - --token
        - $(TUNNEL_TOKEN)
        env:
        - name: TUNNEL_TOKEN
          valueFrom:
            secretKeyRef:
              name: cloudflare-tunnel
              key: token
        livenessProbe:
          httpGet:
            path: /ready
            port: 2000
          initialDelaySeconds: 10
          periodSeconds: 10
        resources:
          requests:
            cpu: 10m
            memory: 64Mi
          limits:
            cpu: 100m
            memory: 128Mi
```

Deploy:

```bash
kubectl apply -f cloudflared-deployment.yaml
```

### 4. Configure Tunnel in Dashboard

1. Go to your tunnel in CloudFlare dashboard
2. Click "Configure"
3. Add a public hostname:
   - **Subdomain:** deckworthy
   - **Domain:** yourdomain.com
   - **Type:** HTTP
   - **URL:** deckworthy.deckworthy.svc.cluster.local:80

4. Save

### 5. Test

Visit https://deckworthy.yourdomain.com

## Option 3: Docker Compose (Alternative)

If you're not using Kubernetes:

```yaml
version: '3.8'
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate run --token ${TUNNEL_TOKEN}
    environment:
      - TUNNEL_TOKEN=${TUNNEL_TOKEN}
```

```bash
# Run
TUNNEL_TOKEN=your-token docker-compose up -d
```

## Using a Custom Domain

### If You Own a Domain

1. **Add domain to CloudFlare:**
   - Go to CloudFlare dashboard
   - Add site
   - Update nameservers at your registrar

2. **Create tunnel and DNS:**
   ```bash
   cloudflared tunnel route dns deckworthy deckworthy.yourdomain.com
   ```

### If You Don't Own a Domain

Use CloudFlare's free subdomain (*.trycloudflare.com):

```bash
# Quick tunnel (temporary)
cloudflared tunnel --url http://localhost:80

# This gives you a random URL like:
# https://random-words-1234.trycloudflare.com
```

**Note:** Free tunnels are temporary and reset on restart. For permanent setup, use a custom domain.

## Advanced Configuration

### Multiple Services

Route different subdomains to different services:

```yaml
ingress:
  - hostname: deckworthy.yourdomain.com
    service: http://localhost:80

  - hostname: api.yourdomain.com
    service: http://localhost:3000

  - hostname: admin.yourdomain.com
    service: http://localhost:8080

  - service: http_status:404
```

### Access Control

Add authentication to your tunnel:

1. Go to CloudFlare dashboard > Access
2. Create an Access Policy
3. Configure authentication (Google, GitHub, email OTP)
4. Apply to your hostname

### Path-Based Routing

Route specific paths:

```yaml
ingress:
  - hostname: yourdomain.com
    path: /deckworthy/*
    service: http://localhost:80

  - hostname: yourdomain.com
    service: http://localhost:8080

  - service: http_status:404
```

### Rate Limiting

CloudFlare automatically provides:
- DDoS protection
- Rate limiting
- Bot protection
- Caching (configurable)

Configure in CloudFlare dashboard > Security.

## Troubleshooting

### Tunnel Not Connecting

```bash
# Check cloudflared logs
sudo journalctl -u cloudflared -f

# Test tunnel
cloudflared tunnel info deckworthy

# List tunnels
cloudflared tunnel list
```

### 502 Bad Gateway

- Check if Deckworthy is running: `kubectl get pods -n deckworthy`
- Verify service URL in config
- Check ingress: `kubectl get ingress -n deckworthy`
- Test locally: `curl http://localhost`

### DNS Not Resolving

```bash
# Check DNS record
dig deckworthy.yourdomain.com

# Recreate DNS record
cloudflared tunnel route dns deckworthy deckworthy.yourdomain.com
```

### Certificate Errors

CloudFlare provides automatic HTTPS. If you see cert errors:
- Ensure CloudFlare proxy is enabled (orange cloud)
- Check SSL/TLS mode in CloudFlare dashboard (use "Full" or "Flexible")

## Monitoring

### Check Tunnel Status

```bash
# Service status
sudo systemctl status cloudflared

# Logs
sudo journalctl -u cloudflared -f
```

### CloudFlare Dashboard

Monitor traffic, analytics, and security events:
- Go to your domain in CloudFlare
- View Analytics tab
- Check Security Events

## Security Best Practices

1. **Enable CloudFlare WAF** (Web Application Firewall)
2. **Set up Access policies** for admin areas
3. **Enable Bot Fight Mode**
4. **Use strong authentication** (2FA on CloudFlare account)
5. **Monitor access logs** regularly
6. **Rate limit sensitive endpoints**

## Cost

**Free tier includes:**
- Unlimited tunnels
- Unlimited bandwidth
- DDoS protection
- Free SSL certificates
- Basic analytics

**Paid features** (optional):
- Advanced DDoS protection
- Advanced WAF rules
- Load balancing
- Argo Smart Routing

For personal projects, **free tier is more than enough**.

## Alternative: Tailscale

If you don't need public access, consider Tailscale for private VPN access:

```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Connect
sudo tailscale up

# Access from any device on your tailnet
# No public exposure required
```

## Next Steps

- Set up monitoring: [MONITORING.md](MONITORING.md)
- Configure backups
- Set up CloudFlare Access for authentication
- Enable CloudFlare Analytics

## Additional Resources

- [CloudFlare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Tunnel GitHub](https://github.com/cloudflare/cloudflared)
- [CloudFlare Community](https://community.cloudflare.com/)
