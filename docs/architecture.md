# Architecture Overview

OpenLDR is built on a modern microservices architecture designed for scalability, maintainability, and extensibility. This document provides an overview of the system architecture, component relationships, and design principles.

## Table of Contents

- [Architecture Overview](#architecture-overview)
  - [Design Principles](#design-principles)
  - [High-Level Architecture](#high-level-architecture)
  - [System Components](#system-components)
  - [Data Flow](#data-flow)
  - [Technology Stack](#technology-stack)
  - [Project Structure](#project-structure)
  - [Service Communication](#service-communication)
  - [Security Architecture](#security-architecture)
  - [Scalability and Performance](#scalability-and-performance)

## Design Principles

OpenLDR follows these core architectural principles:

- **Microservices Architecture**: Each service is independently deployable, maintainable, and scalable
- **Domain-Driven Design**: Services are organized around business capabilities and domains
- **Event-Driven Processing**: Asynchronous communication via Kafka for real-time data processing
- **API-First Design**: Well-defined API contracts for all service interactions
- **Security by Default**: Authentication and authorization at every layer
- **Extensibility**: Plugin-based architecture for custom functionality
- **Cloud-Native**: Containerized deployment with Docker and orchestration support

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                            │
│  ┌──────────────┐              ┌──────────────┐                 │
│  │   Web UI     │              │  External    │                 │
│  │   (React)    │              │   Clients    │                 │
│  └──────────────┘              └──────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Gateway Layer                              │
│  ┌──────────────┐              ┌──────────────┐                 │
│  │    NGINX     │              │    APISIX    │                 │
│  │ Reverse Proxy│              │  API Gateway │                 │
│  └──────────────┘              └──────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Authentication Layer                          │
│                   ┌──────────────┐                              │
│                   │   Keycloak   │                              │
│                   │   Identity   │                              │
│                   └──────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Application Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Entity    │  │ Lab Data    │  │   Mapper    │              │
│  │  Services   │  │     API     │  │             │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Data      │  │ Validation  │  │ Terminology │              │
│  │ Processing  │  │             │  │   Mapping   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Plugins   │  │ MCP Server  │  │   External  │              │
│  │             │  │             │  │   Storage   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Integration Layer                            │
│                   ┌──────────────┐                              │
│                   │    Kafka     │                              │
│                   │ Message Bus  │                              │
│                   └──────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ PostgreSQL  │  │   MinIO     │  │ OpenSearch  │              │
│  │  Database   │  │   Storage   │  │   Search    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

## System Components

### Gateway Layer

#### NGINX (openldr-nginx)

- **Purpose**: Reverse proxy and load balancer
- **Responsibilities**:
  - Route incoming HTTP/HTTPS requests
  - SSL/TLS termination
  - Static file serving
  - Load balancing across service instances
- **Port**: 80, 443

#### APISIX (openldr-apisix)

- **Purpose**: API Gateway and service mesh
- **Responsibilities**:
  - API routing and orchestration
  - Request/response transformation
  - Rate limiting and throttling
  - API versioning
  - Monitoring and observability
- **Port**: 9080, 9443

### Authentication Layer

#### Keycloak (openldr-keycloak)

- **Purpose**: Identity and Access Management (IAM)
- **Responsibilities**:
  - User authentication (SSO, OAuth2, OIDC)
  - Authorization and role management
  - User federation and social login
  - Session management
  - Custom authentication themes
- **Port**: 8080
- **Database**: PostgreSQL

### Application Layer

#### Entity Services (openldr-entity-services)

- **Purpose**: Core CRUD operations for web UI
- **Responsibilities**:
  - Entity management (create, read, update, delete)
  - Business logic for UI operations
  - Data validation and sanitization
  - RESTful API endpoints
- **Technology**: Node.js, TypeScript, Express
- **Database**: PostgreSQL

#### Lab Data API (openldr-lab-data-api)

- **Purpose**: Central Laboratory Data Repository (OpenLDR v1 API)
- **Responsibilities**:
  - Laboratory data ingestion
  - Data retrieval and querying
  - Legacy system integration
  - Backward compatibility
- **Technology**: Node.js, TypeScript
- **Database**: PostgreSQL

#### Data Processing (openldr-data-processing)

- **Purpose**: Asynchronous data processing pipeline
- **Responsibilities**:
  - File format conversion (JSON, JSONL, CSV, TSV, ZIP)
  - Data transformation and enrichment
  - Batch processing workflows
  - Event-driven data pipeline
- **Technology**: Node.js, TypeScript, Kafka consumers
- **Storage**: MinIO, PostgreSQL

#### Mapper (openldr-mapper)

- **Purpose**: Data mapping and transformation
- **Responsibilities**:
  - Schema mapping between different data formats
  - Field-level transformations
  - Data normalization
  - Custom mapping rules
- **Technology**: Node.js, TypeScript

#### Validation (openldr-validation)

- **Purpose**: Data quality and validation
- **Responsibilities**:
  - Schema validation
  - Business rule validation
  - Data integrity checks
  - Validation reporting
- **Technology**: Node.js, TypeScript

#### Terminology Mapping (openldr-terminology-mapping)

- **Purpose**: Standardize medical and laboratory terminology
- **Responsibilities**:
  - Code system mapping (LOINC, SNOMED, ICD)
  - Terminology translation
  - Concept mapping
  - Vocabulary management
- **Technology**: Node.js, TypeScript
- **Database**: PostgreSQL

#### Plugins (openldr-plugins)

- **Purpose**: Extension and plugin management
- **Responsibilities**:
  - Plugin discovery and loading
  - Plugin lifecycle management
  - Extension marketplace integration
  - SDK for plugin development
- **Technology**: Node.js, TypeScript
- **Architecture**: VSCode-style extension system

#### MCP Server (openldr-mcp-server)

- **Purpose**: Model Context Protocol integration
- **Responsibilities**:
  - AI assistant integration
  - Natural language query processing
  - Context management for AI interactions
  - Tool execution for AI agents
- **Technology**: Node.js, TypeScript, MCP SDK

#### External Storage (openldr-external-storage)

- **Purpose**: Manage external storage integrations
- **Responsibilities**:
  - Cloud storage integration
  - External file system access
  - Storage provider abstraction
  - Multi-cloud support
- **Technology**: Node.js, TypeScript

### Integration Layer

#### Kafka (openldr-kafka)

- **Purpose**: Distributed event streaming platform
- **Responsibilities**:
  - Event-driven messaging
  - Real-time data streaming
  - Service decoupling
  - Event sourcing
- **Technology**: Apache Kafka
- **Ports**: 9092 (broker), 2181 (Zookeeper)

### Data Layer

#### PostgreSQL (openldr-internal-database)

- **Purpose**: Primary relational database
- **Responsibilities**:
  - Transactional data storage
  - Relational data management
  - JSONB for flexible schemas
  - Complex queries and joins
- **Technology**: PostgreSQL 14+
- **Features**: JSONB support, full-text search, partitioning

#### MinIO (openldr-minio)

- **Purpose**: Object storage (S3-compatible)
- **Responsibilities**:
  - Large file storage
  - Binary data management
  - Multi-part upload handling
  - Versioning and lifecycle management
- **Technology**: MinIO
- **Ports**: 9000 (API), 9001 (Console)

#### OpenSearch (openldr-opensearch)

- **Purpose**: Search and analytics engine
- **Responsibilities**:
  - Full-text search
  - Metadata indexing
  - Log aggregation and analysis
  - Real-time analytics
- **Technology**: OpenSearch
- **Ports**: 9200 (HTTP), 9600 (Performance Analyzer)

### Frontend Layer

#### Web Application (openldr-web)

- **Purpose**: User interface
- **Responsibilities**:
  - User interaction and experience
  - Data visualization
  - Form management and validation
  - Real-time updates
- **Technology**: React, TypeScript, Vite
- **Features**: i18n support, responsive design, dynamic forms

### Utilities

#### Setup (openldr-setup)

- **Purpose**: System initialization and configuration
- **Responsibilities**:
  - Environment file generation
  - Service discovery configuration
  - Initial setup wizard
  - Configuration validation
- **Technology**: Node.js, TypeScript

## Data Flow

### Typical Request Flow

1. **Client Request**
   - User interacts with Web UI (React)
   - Request sent to NGINX reverse proxy

2. **Gateway Processing**
   - NGINX routes to APISIX API Gateway
   - APISIX applies rate limiting, routing rules

3. **Authentication**
   - Request validated against Keycloak
   - JWT token verified
   - User permissions checked

4. **Service Processing**
   - Request routed to appropriate microservice
   - Business logic executed
   - Data retrieved/stored in PostgreSQL

5. **Event Publishing**
   - Service publishes events to Kafka
   - Async processing triggered

6. **Response**
   - Data formatted and returned
   - Response flows back through gateway
   - Client receives and displays data

### File Upload Flow

```
User Upload → NGINX → APISIX → Entity Services
                                      ↓
                              MinIO (Storage)
                                      ↓
                              Kafka Event Published
                                      ↓
                        ┌─────────────┴─────────────┐
                        ↓                           ↓
                Data Processing              Validation
                        ↓                           ↓
                   Transform                   Validate
                        ↓                           ↓
                PostgreSQL ← ─ ─ ─ ─ ─ ─ ─ ─ OpenSearch
                                  (Index for search)
```

## Technology Stack

### Backend Services

- **Runtime**: Node.js 24+
- **Language**: TypeScript 5+
- **Framework**: Express.js
- **ORM**: Sequelize v7
- **Validation**: Zod, Ajv

### Frontend

- **Framework**: React 18
- **Build Tool**: Vite
- **State Management**: Context API, React Query
- **UI Components**: Tailwindcss, Shadcn, Custom component library
- **Internationalization**: i18next

### Infrastructure

- **Containerization**: Docker
- **Orchestration**: Docker Compose / Kubernetes (future)
- **API Gateway**: Apache APISIX
- **Web Server**: NGINX
- **Message Broker**: Apache Kafka
- **Authentication**: Keycloak (OAuth2, OIDC)

### Databases

- **Relational**: PostgreSQL 14+, Mysql 8+
- **NoSQL**: Redis 7+
- **Object Storage**: MinIO (S3-compatible)
- **Search**: OpenSearch

### Development Tools

- **Monorepo**: Turborepo
- **Linting**: ESLint
- **Formatting**: Prettier
- **Testing**: Mocha
- **Documentation**: Scalar API Docs

## Project Structure

```
openldr/
├── apps/                            # Application services
│   ├── openldr-apisix/              # API Gateway service
│   ├── openldr-data-processing/     # Data processing microservice
│   ├── openldr-entity-services/     # Entity services (CRUD for Web UI)
│   ├── openldr-external-storage/    # External storage microservice
│   ├── openldr-internal-database/   # Internal database service
│   ├── openldr-kafka/               # Message broker service
│   ├── openldr-keycloak/            # Identity and access management
│   ├── openldr-lab-data-api/        # Central Lab Data Repository (v1)
│   ├── openldr-mapper/              # Mapper microservice
│   ├── openldr-mcp-server/          # Model Context Protocol server
│   ├── openldr-minio/               # Object storage service
│   ├── openldr-nginx/               # Reverse proxy service
│   ├── openldr-opensearch/          # Search and metadata storage
│   ├── openldr-plugins/             # Plugin management
│   ├── openldr-setup/               # Initialization tool
│   ├── openldr-terminology-mapping/ # Terminology mapping service
│   ├── openldr-validation/          # Validation microservice
│   └── openldr-web/                 # Frontend application
│
├── packages/                        # Shared packages
│   ├── eslint-config/               # Shared ESLint configuration
│   ├── openldr-core/                # Shared core utilities
│   ├── openldr-extensions/          # Shared extension utilities
│   ├── typescript-config/           # Shared TypeScript configuration
│   └── ui/                          # Shared UI components
│
├── templates/                       # Environment variable templates
│   ├── .env.template.apisix
│   ├── .env.template.entity-services
│   ├── .env.template.keycloak
│   └── ...                          # Additional service templates
│
├── docs/                            # Documentation
│   ├── installation.md
│   ├── architecture.md
│   ├── api.md
│   ├── extensions.md
│   └── mcp-server.md
│
└── tests/                           # Test files
```

## Service Communication

### Synchronous Communication

- **Protocol**: HTTP/HTTPS, REST APIs
- **Use Cases**: Client-server requests, service-to-service calls
- **Authentication**: JWT tokens (issued by Keycloak)
- **Format**: JSON

### Asynchronous Communication

- **Protocol**: Kafka message streaming
- **Use Cases**: Event-driven processing, data pipelines
- **Topics**:
  - `data.uploaded`: File upload events
  - `data.processed`: Processing completion events
  - `validation.requested`: Validation requests
  - `validation.completed`: Validation results
  - `terminology.mapped`: Terminology mapping events

### API Standards

- RESTful API design
- Versioned endpoints (`/api/v1/...`)
- Consistent error responses
- OpenAPI 3.0 specification
- Rate limiting and throttling

## Security Architecture

### Authentication

- **Provider**: Keycloak (OAuth2, OIDC)
- **Token Type**: JWT (JSON Web Tokens)
- **SSO Support**: Yes
- **Multi-factor Authentication**: Configurable

### Authorization

- **Model**: Role-Based Access Control (RBAC)
- **Roles**: To be defined
- **Permissions**: To be defined

### Network Security

- API Gateway as single entry point
- Internal service network isolation
- Rate limiting

## Scalability and Performance

### Horizontal Scaling

- Stateless microservices
- Load balancing via NGINX and APISIX
- Kafka partitioning for parallel processing
- Database read replicas

### Performance Optimization

- Connection pooling (database, Kafka)
- Batch processing for large datasets
- Lazy loading in frontend

## Deployment Architecture

### Development Environment

- Docker Compose for local development
- All services running on single machine
- Development-specific configurations

### Production Environment

- Docker swarm orchestration (recommended)
- Multi-node cluster deployment
- High availability for critical services
- Auto-scaling based on load

### Disaster Recovery (Not yet implemented)

- Database backups (automated)
- MinIO versioning and replication
- Configuration backups
- Disaster recovery runbooks
