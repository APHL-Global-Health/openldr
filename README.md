# Open Laboratory Data Repository

[![Docker](https://img.shields.io/badge/Docker-ready-brightgreen.svg)](https://www.docker.com/)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-24+-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Turborepo](https://img.shields.io/badge/Turborepo-2.7+-brightgreen.svg?logoColor=white)](https://turborepo.dev/)

A comprehensive, microservices-based platform for managing and processing laboratory data using open source tools/resources.

## Key Features

- **Microservices Architecture**: Distributed system with dedicated services for authentication, data management, file storage, and search
- **Multi-Format Support**: Handle JSON, JSONL, ZIP, CSV, TSV, and other laboratory data formats
- **Real-Time Processing**: Event-driven architecture using Apache Kafka for data streaming and processing
- **Advanced Search**: Full-text search capabilities powered by OpenSearch
- **Object Storage**: Scalable file storage using MinIO S3-compatible storage
- **Enterprise Authentication**: Secure identity management with Keycloak SSO
- **API Gateway**: Centralized API management with APISIX
- **Extension Marketplace**: VSCode-style extension system for custom workflows and integrations
- **AI-Powered Interactions**: Model Context Protocol (MCP) server for natural language queries
- **Internationalization**: Multi-language support for global deployment
- **Dynamic Forms**: JSONB-based flexible form system for diverse data structures

## Technology Stack

### Frontend

- React
- TypeScript
- Modern UI/UX components

### Backend

- Node.js
- TypeScript
- RESTful APIs

### Data Layer

- **PostgreSQL**: Primary relational database
- **OpenSearch**: Full-text search and analytics
- **MinIO**: S3-compatible object storage
- **Apache Kafka**: Message streaming and event processing

### Infrastructure

- **Keycloak**: Identity and access management
- **APISIX**: API Gateway
- **Docker**: Containerization
- **Docker Compose**: Multi-container orchestration

### Documentation

- Scalar API Documentation

## Use Cases

- Laboratory data management and tracking
- Healthcare informatics and clinical data processing
- Research data repositories
- Multi-tenant laboratory environments
- Legacy data migration from traditional LIMS

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 24+ (for local development)
- 16GB+ RAM recommended for running all services (in production)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/APHL-Global-Health/openldr.git
cd openldr

# fetch dependences
npm install

# initialize environmental variables
npm run init

# build all services
npm run docker:build

# start all services
npm run docker:start
```

## Documentation

- [Installation Guide](docs/installation.md)
- [Architecture Overview](docs/architecture.md)
- [MCP Server Guide](docs/mcp-server.md)

## Architecture

OpenLDR follows a microservices architecture with the following core components:

- **API Gateway (APISIX)**: Routes and manages all API requests
- **Authentication Service (Keycloak)**: Handles user authentication and authorization
- **Data Service**: Manages laboratory data and metadata
- **File Service**: Handles file uploads and storage with MinIO
- **Search Service**: Provides full-text search via OpenSearch
- **Event Service**: Processes events through Kafka
- **Extension Service**: Manages the extension marketplace

## Contributing

Contributions are welcome! Please read our [Contributing Guide](docs/contributing.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with modern open-source technologies
- Inspired by best practices in laboratory data management
- Community-driven development

## Support

- Issues: [GitHub Issues](https://github.com/APHL-Global-Health/openldr/issues)

---

**Note**: OpenLDR is under active development. Some features may be in beta or experimental stages.
