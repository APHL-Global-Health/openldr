# Project Structure

```
openldr/
├── apps/
│   ├── openldr-apisix/              # API Gateway service
│   ├── openldr-data-processing/     # Data processing microservice
│   ├── openldr-entity-services/     # Entity services microservice (CRUD for Web UI)
│   ├── openldr-external-storage/    # External storage microservice
│   ├── openldr-internal-database/   # Internal database service
│   ├── openldr-kafka/               # Message broker service
│   ├── openldr-keycloak/            # Identity and access management service
│   ├── openldr-lab-data-api/        # Central Lab Data Repository (Openldr v1 - API)
│   ├── openldr-mapper/              # Mapper microservice
│   ├── openldr-mcp-server/          # Model Context Protocol server service
│   ├── openldr-minio/               # Object storage service
│   ├── openldr-nginx/               # Reverse proxy service
│   ├── openldr-opensearch/          # Search and metadata storage service
│   ├── openldr-plugins/             # Plugin management
│   ├── openldr-setup/               # Initialization tool (npm run init)
│   ├── openldr-terminology-mapping/ # Terminology mapping service
│   ├── openldr-validation/          # Validation microservice
│   └── openldr-web/                 # Frontend application (run after microservices are running)
├── packages/
│   ├── eslint-config/               # shared linting options
│   ├── openldr-core/                # shared openldr core options
│   ├── openldr-extensions/          # shared openldr extension options
│   ├── typescript-config/           # shared typescript options
│   └── ui/                          # shared ui options
├── templates/                       # environment variable templates
└── tests/                           # test files (if running in test mode)
```
