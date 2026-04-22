# Installation Guide

This guide will walk you through setting up OpenLDR on your local development machine or remote server.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Docker** (version 20.10 or higher)
- **Docker Compose** (version 2.0 or higher)
- **Node.js** (version 24 or higher)
- **npm** (version 11 or higher)
- **Git**

### System Requirements

- **Memory**: Minimum 16GB RAM (32GB recommended for production)
- **Storage**: At least 512GB free disk space
- **CPU**: Minimum 4 cores recommended (10 cores recommended for production)
- **OS**: Linux, macOS, or Windows with WSL2

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/APHL-Global-Health/openldr.git
cd openldr
```

### 2. Install dependences

```bash
npm install
```

### 3. Run the Initialization Script

The initialization script will configure all necessary environment files and prepare the services for deployment.

```bash
npm run init
```

> **Important**: If you've previously run the initialization script and need to reconfigure, delete all `.env` files from the root directory before running the script again.

### 4. Configure Your Deployment

During the initialization process, you'll be prompted to select an IP address. Choose the appropriate option based on your deployment scenario:

## Deployment Scenarios

### Local Development Instance

For local development on your machine:

- **IP Address**: Use `127.0.0.1` or `localhost`
- **Use Case**: Development, testing, and local experimentation
- **Access**: Only accessible from your local machine

```
When prompted for IP address, select: 127.0.0.1
```

**Access URLs (Local)**:

- Frontend: `https://127.0.0.1/web/`

### Remote/Production Instance

For deployment on a remote server or production environment:

- **IP Address**: Use the **public IP address** of your server
- **Use Case**: Production deployment, team access, external access
- **Access**: Accessible from anywhere (subject to firewall rules)

```
When prompted for IP address, select: <your-server-public-ip>
Example: 203.0.113.45
```

> **Critical Note**: Using the public IP address is **required** for Keycloak's URL rewriting and redirect functionality to work correctly. Using `127.0.0.1` on a remote server will break authentication flows.

**Access URLs (Remote)**:

- Frontend: `https://<your-public-ip>/web/`

## Building the Services

Once initialization is complete, build and start all services:

```bash
# Build services
npm run docker:build

# Start services
npm run docker:start
```

The build process may take several minutes depending on your system and network speed.

## Verifying the Installation

### Check Service Status

After starting the services, verify they're running correctly:

```bash
# View running containers
docker ps

# Check all service statuses
docker-compose ps

# Follow service logs
docker-compose logs -f
```

All services should show status as `Up` or `healthy`.

### Access the Application

Once all services are running, navigate to the frontend URL in your browser:

- **Local**: `https://127.0.0.1/web/`
- **Remote**: `https://<your-public-ip>/web/`

> **Note**: Initial startup may take 5-10 minutes for all services to become fully available. If you see connection errors, wait a few moments and refresh.

## Troubleshooting

### Services Won't Start

```bash
# Check Docker daemon is running
docker info

# View service logs
docker-compose logs <service-name>

# Restart a specific service
docker-compose restart <service-name>
```

### Port Conflicts

If you encounter port binding errors, change to a free port in the .env.template.\* file for that particlar service, then start the installation process again (including deleting .env from root, running init, build and start)

### Memory Issues

OpenLDR requires substantial memory resources to run all services simultaneously.

**Symptoms:**

- Services crashing or restarting repeatedly
- Slow performance or timeouts
- "Out of memory" errors in logs

**If your system doesn't meet minimum requirements:**

- Consider running services on separate machines
- Use a cloud instance with adequate resources
- Disable non-essential services during development

### Keycloak Authentication Issues

If experiencing authentication problems on a remote instance:

1. **Verify IP Configuration**: Ensure you used the **public IP** (not `127.0.0.1`) during initialization
2. **Check Firewall Rules**: Verify that firewall allows traffic on required ports (especially 3000, 8080, 9080)
3. **DNS Resolution**: Ensure hostname resolution is working correctly
4. **Browser Cache**: Clear browser cache and cookies, then try again
