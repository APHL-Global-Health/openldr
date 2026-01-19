import "dotenv/config";
import cors from "cors";
import express from "express";
import path from "path";
import fs from "fs";
import { DynamicModelManager } from "@openldr/internal-database";

import * as userController from "./controllers/userController";
import * as facilityController from "./controllers/facilityController";
import * as projectController from "./controllers/projectController";
import * as useCaseController from "./controllers/useCaseController";
import * as dataFeedController from "./controllers/dataFeedController";
import * as opensearchController from "./controllers/opensearchController";
import * as archiveController from "./controllers/archiveController";
import * as dataEntryController from "./controllers/dataEntryController";
import * as extensionController from "./controllers/extensionController";
import SequelizeToOpenAPIGenerator from "./lib/sequelize-to-openapi-generator";

const MODELS = {
  EXTENSIONS: "extensions",
  EXTENSION_VERSIONS: "extensionVersions",
  EXTENSION_USERS: "extensionUsers",
  EXTENSION_PERMISSIONS: "extensionPermissions",
  EXTENSION_REVIEWS: "extensionReviews",
};

const app = express();
app.use(
  cors({
    origin: "*",
  })
);
app.options("*", cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "25mb" }));

// Serve static files from storage (for development)
app.use("/storage", express.static(path.join(__dirname, "../storage")));

const generateDoc = async (modelManager: DynamicModelManager) => {
  const generator = new SequelizeToOpenAPIGenerator(
    "OpenLDR",
    "1.2.0",
    `
This is an OpenLDR Data Collection & Management platform, that manages multiple open source components using Docker and Docker Compose
      
## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v18 or higher)

- Docker and Docker Compose

- Git

### Installation

1. **Clone the Repository**

\`\`\`bash
git clone https://github.com/APHL-Global-Health/openldr.git
cd openldr
\`\`\`

2. **Install Dependencies**

  Install the required npm packages:

\`\`\`bash
npm install
\`\`\`

3. **Initialize Environment Configuration**

  Configure your environment variables based on your deployment target:      
  > **Note**: 

  > - For **local development**, use \`127.0.0.1\` as your host address

  > - For **cloud deployments**, use your server's public IP address

\`\`\`bash
npm run init
\`\`\`
  
4. **Build Docker Images**

  Build the required Docker images for all microservices:

\`\`\`bash
npm run docker:build
\`\`\`

5. **Start the Application**

  Launch all Docker containers:

\`\`\`bash
npm run docker:start
\`\`\`

### Accessing the Application

Once the containers are running, access the web application at:

- **Local Development**: \`https://127.0.0.1/web\`

- **Cloud Deployment**: \`https://<your-public-ip>/web\`

> **Security Note**: The application uses HTTPS. You may need to accept the self-signed certificate warning in your browser during development.

### Additional Resources

- **GitHub Repository**: [APHL-Global-Health/openldr](https://github.com/APHL-Global-Health/openldr)

- **Documentation**: [Link to full documentation]

- **API Reference**: [Link to API docs]

### Troubleshooting

If you encounter issues during setup, please open an issue on GitHub.

## API Overview

The OpenLDR API is accessible through an APISIX API Gateway that routes requests to the appropriate microservices. The API supports both local development and cloud deployment configurations.

### Base URLs

The API can be accessed through the following base URLs:

#### Primary Endpoint (Recommended)

\`\`\`
https://127.0.0.1/apisix-gateway
\`\`\`

This is the main entry point for all API requests in local development. APISIX Gateway handles:
- Request routing to backend microservices
- Authentication and authorization
- Rate limiting and security policies
- Load balancing across service instances

#### Flexible Endpoint

\`\`\`
{protocol}://127.0.0.1/{path}
\`\`\`



**Example Configurations:**

\`\`\`bash
# Standard HTTPS connection
https://127.0.0.1/apisix-gateway

# Custom path routing
https://127.0.0.1/api/v1

# HTTP connection (development only)
http://127.0.0.1/apisix-gateway
\`\`\`

### Environment-Specific Configuration

#### Local Development

- **Base URL**: \`https://127.0.0.1/apisix-gateway\`

- **Host**: \`127.0.0.1\` (localhost)

- **Protocol**: HTTPS with self-signed certificate

#### Cloud Deployment
- **Base URL**: \`https://<your-public-ip>/apisix-gateway\`

- **Host**: Your server's public IP address

- **Protocol**: HTTPS with valid SSL certificate (recommended)

### Authentication

All API requests require authentication through Keycloak. Include your access token in the request headers:

\`\`\`http
Authorization: Bearer 
\`\`\`

To obtain an access token, refer to the [Authentication](#authentication) section.

### Rate Limiting

The API gateway implements rate limiting to ensure system stability:

- **Default**: 100 requests per minute per IP

- **Authenticated**: 1000 requests per minute per user

Exceeded limits return a \`429 Too Many Requests\` response.

### Security Considerations

> **Important**: 

> - Always use HTTPS in production environments

> - Self-signed certificates are acceptable for local development only

> - Ensure your API keys and tokens are stored securely

> - Never commit credentials to version control


    `.trim()
  );

  // ========================================================================
  // STEP 1: Add Standard Components (Parameters, Headers, Responses, Errors)
  // ========================================================================
  generator.addStandardComponents();

  // ========================================================================
  // STEP 2: Add Security Schemes
  // ========================================================================
  generator.addSecuritySchemes({
    bearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description: "JWT token for authentication",
    },
  });

  generator.setGlobalSecurity([{ bearerAuth: [] }]);

  // ========================================================================
  // STEP 3: Add Servers
  // ========================================================================
  generator.addServers([
    {
      url: "https://127.0.0.1/apisix-gateway",
    },
    {
      url: "{protocol}://127.0.0.1/{path}",
      description: "Responds with your request data",
      variables: {
        protocol: {
          enum: ["https", "http"],
          default: "https",
        },
        path: {
          default: "",
        },
      },
    },
  ]);

  // ========================================================================
  // STEP 4: Load APISIX Configs
  // ========================================================================
  const apisixConfigFiles = path.resolve(
    process.cwd(),
    "..",
    "openldr-apisix",
    "apisix_conf",
    "init-routes"
  );

  if (fs.existsSync(apisixConfigFiles)) {
    const configFiles = fs
      .readdirSync(apisixConfigFiles)
      .filter((file) => file.endsWith(".json"))
      .map((file) => path.join(apisixConfigFiles, file));

    generator.loadAPISIXConfigs(configFiles);
  }

  // ========================================================================
  // STEP 5: Add Tags
  // ========================================================================
  generator.addTags([
    { name: "Users", description: "Manage users" },
    { name: "Facilities", description: "Manage facilities" },
    { name: "Projects", description: "Manage projects" },
    { name: "Use Cases", description: "Manage use cases" },
    { name: "Data Feeds", description: "Manage data feeds" },
    { name: "OpenSearch", description: "Manage OpenSearch" },
    { name: "Archives", description: "Manage archives" },
    { name: "Forms", description: "Manage forms" },
    { name: "Extensions", description: "Manage extensions" },
  ]);

  // ========================================================================
  // STEP 6: Add Models
  // ========================================================================
  const models = Array.from((await modelManager.preloadAllModels()).values());
  models.forEach((model: any) => {
    generator.addModel(model, {
      exclude: ["password", "deletedAt", "createdAt", "updatedAt"],
    });
  });

  // ========================================================================
  // STEP 7: Add Routers
  // ========================================================================
  const userRouter = userController.router(modelManager);
  const facilityRouter = facilityController.router(modelManager);
  const projectRouter = projectController.router(modelManager);
  const useCaseRouter = useCaseController.router(modelManager);
  const dataFeedRouter = dataFeedController.router(modelManager);
  const openSearchRouter = opensearchController.router;
  const archiveRouter = archiveController.router(modelManager);
  const formsRouter = dataEntryController.router(modelManager);
  const extensionsRouter = extensionController.router(modelManager);

  app.use("/user", userRouter);
  app.use("/facility", facilityRouter);
  app.use("/project", projectRouter);
  app.use("/useCase", useCaseRouter);
  app.use("/dataFeed", dataFeedRouter);
  app.use("/openSearch", openSearchRouter);
  app.use("/archive", archiveRouter);
  app.use("/forms", formsRouter);
  app.use("/extensions", extensionsRouter);

  generator.addRouters([
    {
      router: userRouter,
      basePath: "/user",
      options: { tags: ["Users"] },
    },
    {
      router: facilityRouter,
      basePath: "/facility",
      options: { tags: ["Facilities"] },
    },
    {
      router: projectRouter,
      basePath: "/project",
      options: { tags: ["Projects"] },
    },
    {
      router: useCaseRouter,
      basePath: "/useCase",
      options: { tags: ["Use Cases"] },
    },
    {
      router: dataFeedRouter,
      basePath: "/dataFeed",
      options: { tags: ["Data Feeds"] },
    },
    {
      router: openSearchRouter,
      basePath: "/openSearch",
      options: { tags: ["OpenSearch"] },
    },
    {
      router: archiveRouter,
      basePath: "/archive",
      options: { tags: ["Archives"] },
    },
    {
      router: formsRouter,
      basePath: "/forms",
      options: { tags: ["Forms"] },
    },
    {
      router: extensionsRouter,
      basePath: "/extensions",
      options: { tags: ["Extensions"] },
    },
  ]);

  return generator;
};

(async () => {
  try {
    const modelManager = await DynamicModelManager.create(
      process.env.INTERNAL_DB_PREFERRED_DIALET
    );

    console.log("\nDatabase connection established successfully.\n");

    const generator = await generateDoc(modelManager);
    app.get("/api-doc/:format", async (req, res) => {
      const { format } = req.params;
      const doc = format === "yaml" ? generator.toYAML() : generator.toJSON();
      if (format === "yaml") {
        return res.status(200).type("yaml").send(doc);
      } else {
        return res.status(200).json(JSON.parse(doc));
      }
    });

    // Start the server
    const port = process.env.ENTITY_SERVICES_PORT || 1002;
    app.listen(port, () => {
      console.log(`\nOpenLDR Entity Services running on port ${port}`);
    });
  } catch (error) {
    console.error("Test Error:", error);
  }
})();
