# DigitalOcean Droplet Deployment Guide

## Traxmate Bridge - DigitalOcean Deployment Options

This guide provides multiple deployment options for deploying the Traxmate Bridge middleware to a DigitalOcean droplet.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Option 1: Manual Droplet Setup (Recommended)](#option-1-manual-droplet-setup-recommended)
3. [Option 2: Docker Deployment](#option-2-docker-deployment)
4. [Option 3: DigitalOcean App Platform](#option-3-digitalocean-app-platform)
5. [SSL Setup](#ssl-setup-optional)
6. [Testing & Monitoring](#testing--monitoring)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

- DigitalOcean account
- Domain name (optional but recommended)
- SSH key configured (recommended over password auth)
- Local Git access to your repository

## Option 1: Manual Droplet Setup (Recommended)

This option gives you full control and is great for learning server administration.

### Step 1: Create DigitalOcean Droplet

1. **Log into DigitalOcean** and create a new project
2. **Create Droplet:**
   - Choose **Ubuntu 22.04 LTS**
   - Select **Basic plan** with at least **1GB RAM** ($6/month)
   - Choose a datacenter region close to you
   - Add your **SSH keys** for secure access
   - Give it a hostname like `traxmate-bridge`
   - Click **Create Droplet**

### Step 2: Initial Server Setup

SSH into your droplet:
```bash
ssh root@YOUR_DROPLET_IP
```

Update the system and install required packages:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (using NodeSource repository)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify Node.js installation
node --version
npm --version

# Install PM2 globally (process manager)
sudo npm install -g pm2

# Install Nginx (web server/reverse proxy)
sudo apt install nginx -y

# Install Git
sudo apt install git -y

# Configure firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
```

### Step 3: Deploy Your Application

```bash
# Navigate to web directory
cd /var/www

# Clone your repository
git clone https://github.com/YOUR_USERNAME/Traxmate-Bridge.git
cd Traxmate-Bridge

# Install dependencies
npm install

# Copy and configure environment file
cp env.example .env

# Edit environment variables
nano .env
```

**Important Environment Variables:**
```env
CISCO_SPACES_ACCESS_TOKEN=your_cisco_token
TRAXMATE_API_KEY=your_traxmate_key
NODE_ENV=production
PORT=8080
LOG_LEVEL=info
```

### Step 4: Configure PM2 Process Manager

```bash
# Start your app with PM2
pm2 start src/app.js --name "traxmate-bridge"

# Save PM2 configuration
pm2 save

# Set PM2 to start on boot
pm2 startup
# Copy and run the command that PM2 outputs

# Check status
pm2 status
pm2 logs traxmate-bridge
```

### Step 5: Configure Nginx Reverse Proxy

Create Nginx configuration:
```bash
sudo nano /etc/nginx/sites-available/traxmate-bridge
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    # Main application proxy
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:8080/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
}
```

Enable the site:
```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/traxmate-bridge /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## Option 2: Docker Deployment

Using your existing Dockerfile for a containerized deployment.

### Step 1: Create Droplet and Install Docker

Follow Step 1 from Option 1, then:

```bash
# SSH into droplet
ssh root@YOUR_DROPLET_IP

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose -y

# Add user to docker group (optional)
sudo usermod -aG docker $USER

# Install Nginx for reverse proxy
sudo apt install nginx -y
```

### Step 2: Deploy with Docker

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/Traxmate-Bridge.git
cd Traxmate-Bridge

# Create environment file
cp env.example .env
nano .env

# Build the Docker image
sudo docker build -t traxmate-bridge .

# Run the container
sudo docker run -d \
  --name traxmate-bridge \
  --restart unless-stopped \
  -p 8080:8080 \
  --env-file .env \
  traxmate-bridge

# Check container status
sudo docker ps
sudo docker logs traxmate-bridge
```

### Step 3: Configure Nginx (same as Option 1 Step 5)

Follow the Nginx configuration from Option 1, Step 5.

### Docker Management Commands

```bash
# View running containers
sudo docker ps

# View logs
sudo docker logs traxmate-bridge

# Stop container
sudo docker stop traxmate-bridge

# Start container
sudo docker start traxmate-bridge

# Update application
sudo docker stop traxmate-bridge
sudo docker rm traxmate-bridge
git pull
sudo docker build -t traxmate-bridge .
sudo docker run -d --name traxmate-bridge --restart unless-stopped -p 8080:8080 --env-file .env traxmate-bridge
```

## Option 3: DigitalOcean App Platform

The easiest option with automatic scaling and management.

### Step 1: Prepare Your Repository

Ensure your repository has:
- `package.json` with proper scripts
- Environment variables documented
- Port configuration using `process.env.PORT`

### Step 2: Deploy to App Platform

1. **Login to DigitalOcean** and navigate to App Platform
2. **Create App** and connect your GitHub repository
3. **Configure the app:**
   - **Resource Type:** Web Service
   - **Runtime:** Node.js
   - **Build Command:** `npm install`
   - **Run Command:** `npm start`
   - **Port:** 8080
4. **Set Environment Variables:**
   - `CISCO_SPACES_ACCESS_TOKEN`
   - `TRAXMATE_API_KEY`
   - `NODE_ENV=production`
5. **Deploy** - App Platform handles everything automatically

### App Platform Benefits

- Automatic SSL certificates
- Built-in monitoring and logging
- Auto-scaling
- Zero-downtime deployments
- Managed infrastructure

## SSL Setup (Optional)

### For Manual/Docker Deployments

If you have a domain name, set up free SSL with Let's Encrypt:

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run

# Set up automatic renewal (crontab)
sudo crontab -e
# Add this line:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

### Updated Nginx Configuration with SSL

After SSL setup, your Nginx config will look like:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Testing & Monitoring

### Testing Your Deployment

```bash
# Test locally on the droplet
curl http://localhost:8080/health

# Test from outside (replace with your IP/domain)
curl http://YOUR_DROPLET_IP/health
curl https://your-domain.com/health

# Test WebSocket connection (if applicable)
wscat -c ws://your-domain.com
```

### Monitoring Commands

```bash
# PM2 monitoring
pm2 status
pm2 logs traxmate-bridge
pm2 monit

# Nginx monitoring
sudo systemctl status nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# System monitoring
htop           # CPU and memory usage
df -h          # Disk usage
free -h        # Memory usage
netstat -tulpn # Port usage
```

### Log Management

```bash
# Application logs (PM2)
pm2 logs traxmate-bridge --lines 100

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# System logs
sudo journalctl -u nginx -f
sudo journalctl -xe
```

## Troubleshooting

### Common Issues

1. **Application not starting:**
   ```bash
   pm2 logs traxmate-bridge
   # Check environment variables
   cat .env
   ```

2. **Nginx 502 Bad Gateway:**
   ```bash
   # Check if app is running
   pm2 status
   # Check Nginx config
   sudo nginx -t
   # Check logs
   sudo tail -f /var/log/nginx/error.log
   ```

3. **Port conflicts:**
   ```bash
   # Check what's using port 8080
   sudo netstat -tulpn | grep 8080
   sudo lsof -i :8080
   ```

4. **SSL certificate issues:**
   ```bash
   # Check certificate status
   sudo certbot certificates
   # Test renewal
   sudo certbot renew --dry-run
   ```

### Performance Optimization

1. **Enable Gzip compression in Nginx:**
   ```nginx
   gzip on;
   gzip_vary on;
   gzip_min_length 1024;
   gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
   ```

2. **PM2 Cluster Mode:**
   ```bash
   pm2 start src/app.js --name "traxmate-bridge" -i max
   ```

3. **Monitor resource usage:**
   ```bash
   # Install monitoring tools
   sudo apt install htop iotop nethogs -y
   ```

### Updating Your Application

```bash
# For manual deployments
cd /var/www/Traxmate-Bridge
git pull
npm install
pm2 restart traxmate-bridge

# For Docker deployments
cd /var/www/Traxmate-Bridge
git pull
sudo docker stop traxmate-bridge
sudo docker rm traxmate-bridge
sudo docker build -t traxmate-bridge .
sudo docker run -d --name traxmate-bridge --restart unless-stopped -p 8080:8080 --env-file .env traxmate-bridge
```

## Cost Considerations

- **Basic Droplet (1GB RAM):** $6/month
- **Standard Droplet (2GB RAM):** $12/month
- **App Platform (Basic):** $5/month + usage
- **Domain + SSL:** Free with Let's Encrypt

## Security Best Practices

1. **Use SSH keys instead of passwords**
2. **Configure firewall properly**
3. **Keep system updated**
4. **Use environment variables for secrets**
5. **Enable SSL/HTTPS**
6. **Regular backups**
7. **Monitor logs for suspicious activity**

---

**Need help?** Check the troubleshooting section or refer to the main project documentation in `docs/`. 