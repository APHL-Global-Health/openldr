import yaml from "js-yaml";
import * as fs from "fs";
import * as path from "path";
import { Router } from "express";

type HttpMethod =
  | "get"
  | "post"
  | "put"
  | "patch"
  | "delete"
  | "options"
  | "head";

interface RouteLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{
      method: string;
      handle: {
        name?: string;
      };
    }>;
  };
  name?: string;
  regexp?: RegExp;
  keys?: Array<{ name: string }>;
  handle?: {
    stack?: RouteLayer[];
  };
}

interface APISIXRoute {
  id: string;
  uri: string;
  name: string;
  methods: string[];
  rewrite_uri: [string, string]; // [pattern, replacement]
  upstream_url: string;
}

interface APISIXRewriteRule {
  pattern: RegExp;
  replacement: string;
  externalUri: string;
  internalUri: string;
  methods: string[];
  name?: string;
}

interface OpenAPISchema {
  type: string;
  format?: string;
  enum?: string[];
  items?: OpenAPISchema;
  properties?: Record<string, OpenAPISchema>;
  required?: string[];
  description?: string;
  example?: any;
  nullable?: boolean;
  maxLength?: number;
  minLength?: number;
  minimum?: number;
  maximum?: number;
}

interface OpenAPIComponent {
  schemas: Record<string, OpenAPISchema>;
  securitySchemes?: Record<string, any>;
  parameters?: Record<string, any>;
  headers?: Record<string, any>;
  responses?: Record<string, any>;
}

interface OpenAPITag {
  name: string;
  description?: string | undefined;
  externalDocs?: {
    description?: string | undefined;
    url: string;
  };
}

interface OpenAPIServer {
  url: string;
  description?: string;
  variables?: Record<
    string,
    {
      enum?: string[];
      default: string;
      description?: string;
    }
  >;
}

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string | undefined;
  };
  servers?: OpenAPIServer[];
  tags?: OpenAPITag[];
  components: OpenAPIComponent;
  paths?: Record<string, any>;
  security?: Array<Record<string, string[]>>;
}

class SequelizeToOpenAPIGenerator {
  private spec: OpenAPISpec;
  private apisixRewriteRules: APISIXRewriteRule[] = [];

  constructor(
    title: string = "OpenLDR API",
    version: string = "1.0.0",
    description?: string
  ) {
    this.spec = {
      openapi: "3.0.3",
      info: {
        title,
        version,
        description,
      },
      servers: [],
      tags: [],
      components: {
        schemas: {},
      },
      paths: {},
    };
  }

  /**
   * Maps Sequelize DataTypes to OpenAPI schema types
   */
  private mapSequelizeTypeToOpenAPI(dataType: any): OpenAPISchema {
    const typeString = dataType.constructor.name || dataType.toString();

    // String types
    if (
      typeString.includes("STRING") ||
      typeString.includes("TEXT") ||
      typeString.includes("CHAR")
    ) {
      const schema: OpenAPISchema = { type: "string" };

      // Check for length constraints
      if (dataType.options?.length) {
        schema.maxLength = dataType.options.length;
      }

      // Check for ENUM
      if (typeString.includes("ENUM") && dataType.values) {
        schema.enum = dataType.values;
      }

      return schema;
    }

    // UUID
    if (typeString.includes("UUID")) {
      return { type: "string", format: "uuid" };
    }

    // Integer types
    if (
      typeString.includes("INTEGER") ||
      typeString.includes("BIGINT") ||
      typeString.includes("SMALLINT")
    ) {
      return { type: "integer", format: "int64" };
    }

    // Float/Double types
    if (
      typeString.includes("FLOAT") ||
      typeString.includes("DOUBLE") ||
      typeString.includes("REAL")
    ) {
      return { type: "number", format: "double" };
    }

    // Decimal
    if (typeString.includes("DECIMAL")) {
      return { type: "number" };
    }

    // Boolean
    if (typeString.includes("BOOLEAN")) {
      return { type: "boolean" };
    }

    // Date types
    if (typeString.includes("DATE")) {
      return { type: "string", format: "date-time" };
    }

    if (typeString.includes("DATEONLY")) {
      return { type: "string", format: "date" };
    }

    // Time
    if (typeString.includes("TIME")) {
      return { type: "string", format: "time" };
    }

    // JSON/JSONB
    if (typeString.includes("JSON")) {
      return { type: "object" };
    }

    // BLOB/Binary
    if (typeString.includes("BLOB")) {
      return { type: "string", format: "binary" };
    }

    // Array
    if (typeString.includes("ARRAY")) {
      const itemType = dataType.type || dataType.options?.type;
      return {
        type: "array",
        items: itemType
          ? this.mapSequelizeTypeToOpenAPI(itemType)
          : { type: "string" },
      };
    }

    // Default fallback
    return { type: "string" };
  }

  /**
   * Converts a Sequelize model to an OpenAPI schema
   */
  public addModel(
    ModelClass: any,
    options?: {
      exclude?: string[];
      include?: string[];
      schemaName?: string;
    }
  ): void {
    const schemaName = options?.schemaName || ModelClass.name;
    const attributes = ModelClass.getAttributes();

    const properties: Record<string, OpenAPISchema> = {};
    const required: string[] = [];

    for (const [fieldName, attribute] of Object.entries(attributes)) {
      // Handle include/exclude filters
      if (options?.exclude?.includes(fieldName)) continue;
      if (options?.include && !options.include.includes(fieldName)) continue;

      const attr = attribute as any;
      const schema = this.mapSequelizeTypeToOpenAPI(attr.type);

      // Add nullable flag
      if (attr.allowNull !== false) {
        schema.nullable = true;
      } else {
        required.push(fieldName);
      }

      // Add description from comment
      if (attr.comment) {
        schema.description = attr.comment;
      }

      // Add default value as example
      if (attr.defaultValue !== undefined && attr.defaultValue !== null) {
        schema.example = attr.defaultValue;
      }

      properties[fieldName] = schema;
    }

    const schema: OpenAPISchema = {
      type: "object",
      properties,
    };

    if (required.length > 0) {
      schema.required = required;
    }

    this.spec.components.schemas[schemaName] = schema;
  }

  /**
   * Add multiple models at once
   */
  public addModels(
    models: any[],
    options?: {
      exclude?: string[];
      include?: string[];
    }
  ): void {
    models.forEach((model) => this.addModel(model, options));
  }

  /**
   * Generate standard CRUD paths for a model
   */
  public addCRUDPaths(
    ModelClass: any,
    basePath: string,
    options?: {
      schemaName?: string;
      idParam?: string;
      operations?: ("list" | "create" | "get" | "update" | "delete")[];
      tags?: string[];
    }
  ): void {
    const schemaName = options?.schemaName || ModelClass.name;
    const idParam = options?.idParam || "id";
    const operations = options?.operations || [
      "list",
      "create",
      "get",
      "update",
      "delete",
    ];
    const table = ModelClass.table;
    const tableName =
      typeof table === "string" ? table : table?.tableName || "unknown";
    const tags = options?.tags || [tableName || ModelClass.name];

    const paths: Record<string, any> = {};

    // List and Create operations
    if (operations.includes("list") || operations.includes("create")) {
      paths[basePath] = {};

      if (operations.includes("list")) {
        paths[basePath].get = {
          tags,
          summary: `List all ${ModelClass.name} records`,
          operationId: `list${ModelClass.name}`,
          parameters: [
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 100 },
            },
            {
              name: "offset",
              in: "query",
              schema: { type: "integer", default: 0 },
            },
          ],
          responses: {
            "200": {
              description: "Successful response",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: { $ref: `#/components/schemas/${schemaName}` },
                      },
                      total: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        };
      }

      if (operations.includes("create")) {
        paths[basePath].post = {
          tags,
          summary: `Create a new ${ModelClass.name}`,
          operationId: `create${ModelClass.name}`,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: `#/components/schemas/${schemaName}` },
              },
            },
          },
          responses: {
            "201": {
              description: "Created successfully",
              content: {
                "application/json": {
                  schema: { $ref: `#/components/schemas/${schemaName}` },
                },
              },
            },
          },
        };
      }
    }

    // Get, Update, Delete operations
    if (
      operations.includes("get") ||
      operations.includes("update") ||
      operations.includes("delete")
    ) {
      const itemPath = `${basePath}/{${idParam}}`;
      paths[itemPath] = {};

      if (operations.includes("get")) {
        paths[itemPath].get = {
          tags,
          summary: `Get ${ModelClass.name} by ID`,
          operationId: `get${ModelClass.name}ById`,
          parameters: [
            {
              name: idParam,
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Successful response",
              content: {
                "application/json": {
                  schema: { $ref: `#/components/schemas/${schemaName}` },
                },
              },
            },
            "404": {
              description: "Not found",
            },
          },
        };
      }

      if (operations.includes("update")) {
        paths[itemPath].put = {
          tags,
          summary: `Update ${ModelClass.name} by ID`,
          operationId: `update${ModelClass.name}`,
          parameters: [
            {
              name: idParam,
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: `#/components/schemas/${schemaName}` },
              },
            },
          },
          responses: {
            "200": {
              description: "Updated successfully",
              content: {
                "application/json": {
                  schema: { $ref: `#/components/schemas/${schemaName}` },
                },
              },
            },
            "404": {
              description: "Not found",
            },
          },
        };
      }

      if (operations.includes("delete")) {
        paths[itemPath].delete = {
          tags,
          summary: `Delete ${ModelClass.name} by ID`,
          operationId: `delete${ModelClass.name}`,
          parameters: [
            {
              name: idParam,
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "204": {
              description: "Deleted successfully",
            },
            "404": {
              description: "Not found",
            },
          },
        };
      }
    }

    // Merge paths into spec
    this.spec.paths = { ...this.spec.paths, ...paths };
  }

  /**
   * Export to YAML string
   */
  public toYAML(): string {
    return yaml.dump(this.spec, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
    });
  }

  /**
   * Export to JSON string
   */
  public toJSON(): string {
    return JSON.stringify(this.spec, null, 2);
  }

  /**
   * Save to file
   */
  public saveToFile(filePath: string, format: "yaml" | "json" = "yaml"): void {
    const content = format === "yaml" ? this.toYAML() : this.toJSON();
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, content, "utf-8");
    console.log(`OpenAPI specification saved to: ${filePath}`);
  }

  /**
   * Load APISIX configuration from a JSON file
   */
  public loadAPISIXConfig(configPath: string): void {
    if (!fs.existsSync(configPath)) {
      throw new Error(`APISIX config file not found: ${configPath}`);
    }

    const configContent = fs.readFileSync(configPath, "utf-8");
    const routes: APISIXRoute[] = JSON.parse(configContent);

    routes.forEach((route) => {
      this.addAPISIXRoute(route);
    });

    console.log(`✓ Loaded ${routes.length} APISIX routes from ${configPath}`);
  }

  /**
   * Load multiple APISIX configs at once
   */
  public loadAPISIXConfigs(configPaths: string[]): void {
    configPaths.forEach((configPath) => {
      this.loadAPISIXConfig(configPath);
    });
  }

  /**
   * Add a single APISIX route configuration
   */
  public addAPISIXRoute(route: APISIXRoute): void {
    // Parse the rewrite rule: [external_pattern, internal_replacement]
    // Example: ["/api/v1/openldr/extensions/(.*?)/info", "/extensions/$1/info"]
    // This means: external /api/v1/openldr/extensions/abc/info -> internal /extensions/abc/info
    // We need the reverse: internal /extensions/abc/info -> external /api/v1/openldr/extensions/abc/info

    const [externalPattern, internalReplacement] = route.rewrite_uri;

    this.apisixRewriteRules.push({
      pattern: new RegExp(""), // Not used in new implementation
      replacement: internalReplacement,
      externalUri: route.uri,
      internalUri: internalReplacement,
      methods: route.methods
        .filter((m) => m !== "OPTIONS")
        .map((m) => m.toLowerCase()),
      name: route.name,
    });
  }

  /**
   * Apply APISIX rewrite rules to transform internal path to external path
   *
   * APISIX config format: [external_pattern, internal_replacement]
   * Example: ["/api/v1/openldr/extensions/(.*?)/info", "/extensions/$1/info"]
   *
   * We need to reverse this:
   * - Input: internal Express route "/extensions/:extensionId/info"
   * - Output: external APISIX route "/api/v1/openldr/extensions/{extensionId}/info"
   */
  private applyAPISIXRewrite(
    internalPath: string,
    method: string
  ): {
    externalPath: string;
    matched: boolean;
    routeName?: string | undefined;
  } {
    const normalizedInternal = internalPath.replace(/\/$/, ""); // Remove trailing slash

    for (const rule of this.apisixRewriteRules) {
      // Check if methods match
      if (!rule.methods.includes(method.toLowerCase())) {
        continue;
      }

      // The rule.internalUri is the pattern we need to match against
      // Example: "/extensions/$1/info"
      let internalPattern = rule.internalUri.replace(/\/$/, "");

      // Convert $1, $2, etc. to capture groups for regex
      // Example: "/extensions/$1/info" -> "/extensions/([^/]+)/info"
      const regexPattern = internalPattern
        .replace(/\$\d+/g, "([^/]+)")
        .replace(/\//g, "\\/");

      const regex = new RegExp(`^${regexPattern}$`);

      // Try to match the internal path
      const match = normalizedInternal.match(regex);

      if (match) {
        // Found a match! Now construct the external URL
        let externalPath = rule.externalUri;

        // Get the parameter names from the internal path (e.g., :packageId, :version)
        const paramNames =
          normalizedInternal.match(/:(\w+)/g)?.map((p) => p.substring(1)) || [];

        // Replace wildcards (*) in external URI with parameter names
        let wildcardIndex = 0;
        externalPath = externalPath.replace(/\*/g, () => {
          if (wildcardIndex < paramNames.length) {
            const paramName = paramNames[wildcardIndex];
            wildcardIndex++;
            return `{${paramName}}`;
          }
          return "*";
        });

        return {
          externalPath,
          matched: true,
          routeName: rule.name,
        };
      }
    }

    // No match found, return original path
    return {
      externalPath: internalPath,
      matched: false,
    };
  }

  /**
   * Extract routes from an Express Router
   */
  private extractRoutesFromRouter(
    router: Router
  ): Array<{ path: string; method: string }> {
    const routes: Array<{ path: string; method: string }> = [];

    if (!router || !router.stack) {
      return routes;
    }

    const processLayer = (layer: RouteLayer, basePath: string = "") => {
      if (layer.route) {
        // This is a route layer
        const routePath = basePath + layer.route.path;
        const methods = Object.keys(layer.route.methods);

        methods.forEach((method) => {
          routes.push({
            path: routePath,
            method: method.toLowerCase(),
          });
        });
      } else if (
        layer.name === "router" &&
        layer.handle &&
        "stack" in layer.handle
      ) {
        // This is a nested router
        const nestedPath = layer.regexp
          ? this.getPathFromRegex(layer.regexp, layer.keys)
          : "";
        const fullPath = basePath + nestedPath;

        (layer.handle.stack as unknown as RouteLayer[]).forEach(
          (nestedLayer) => {
            processLayer(nestedLayer, fullPath);
          }
        );
      }
    };

    (router.stack as unknown as RouteLayer[]).forEach((layer) =>
      processLayer(layer)
    );

    return routes;
  }

  /**
   * Extract path from Express router regex
   */
  private getPathFromRegex(
    regexp: RegExp,
    keys?: Array<{ name: string }>
  ): string {
    let path = regexp
      .toString()
      .replace(/^\/\^/, "")
      .replace(/\$\/$/, "")
      .replace(/\\\//g, "/")
      .replace(/\(\?:\(\[\^\\\/\]\+\?\)\)/g, ":param")
      .replace(/\\\\/g, "\\")
      .replace(/\?(?:\?)/g, "");

    // Replace with actual param names if available
    if (keys && keys.length > 0) {
      keys.forEach((key, index) => {
        path = path.replace(":param", `:${key.name}`);
      });
    }

    return path;
  }

  /**
   * Add paths from an Express Router
   */
  public addRouterPaths(
    router: Router,
    basePath: string,
    options?: {
      tags?: string[];
      schemaRefs?: Record<string, string>; // Map of path patterns to schema names
      descriptions?: Record<string, string>; // Map of operation IDs to descriptions
      summaries?: Record<string, string>; // Map of operation IDs to summaries
      excludePaths?: string[];
      excludeMethods?: string[];
      applyAPISIXRewrite?: boolean; // Default: true if APISIX rules are loaded
      security?: Array<Record<string, string[]>> | false; // Security for these routes (false = no auth, undefined = use global)
      publicPaths?: string[]; // Paths that don't require authentication
      securePaths?: string[]; // Paths that require authentication (with specific security)
      securityOverrides?: Record<
        string,
        Array<Record<string, string[]>> | false
      >; // Per-path security
    }
  ): void {
    const routes = this.extractRoutesFromRouter(router);
    const tags = options?.tags || [];
    const excludePaths = options?.excludePaths || [];
    const excludeMethods = options?.excludeMethods || [];
    const applyAPISIXRewrite =
      options?.applyAPISIXRewrite !== false &&
      this.apisixRewriteRules.length > 0;

    routes.forEach(({ path: routePath, method }) => {
      const internalPath = basePath + routePath;

      // Check exclusions
      if (excludePaths.some((exclude) => internalPath.includes(exclude)))
        return;
      if (excludeMethods.includes(method)) return;

      // Apply APISIX rewrite if enabled
      let finalPath = internalPath;
      let routeName: string | undefined;

      if (applyAPISIXRewrite) {
        const rewriteResult = this.applyAPISIXRewrite(internalPath, method);
        if (rewriteResult.matched) {
          finalPath = rewriteResult.externalPath;
          routeName = rewriteResult.routeName;
        }
      }

      // Initialize path if it doesn't exist
      if (!this.spec.paths![finalPath]) {
        this.spec.paths![finalPath] = {};
      }

      // Generate operation ID
      const operationId = `${method}${finalPath.replace(/\//g, "_").replace(/[{}:]/g, "")}`;

      // Try to find schema reference based on path pattern
      let schemaRef: string | undefined;
      if (options?.schemaRefs) {
        for (const [pattern, schema] of Object.entries(options.schemaRefs)) {
          if (internalPath.includes(pattern)) {
            schemaRef = schema;
            break;
          }
        }
      }

      // Build the operation
      const operation: any = {
        tags,
        operationId,
        summary:
          routeName ||
          options?.summaries?.[operationId] ||
          `${method.toUpperCase()} ${finalPath}`,
        responses: {
          "200": {
            description: "Successful response",
          },
        },
      };

      // Add description if provided
      if (options?.descriptions?.[operationId]) {
        operation.description = options.descriptions[operationId];
      }

      // Determine security for this specific endpoint
      let endpointSecurity: Array<Record<string, string[]>> | false | undefined;

      // Check per-path security overrides first
      if (
        options?.securityOverrides &&
        options.securityOverrides[finalPath] !== undefined
      ) {
        endpointSecurity = options.securityOverrides[finalPath];
      }
      // Check if path is explicitly public
      else if (
        options?.publicPaths?.some(
          (p) => finalPath.includes(p) || internalPath.includes(p)
        )
      ) {
        endpointSecurity = false; // No authentication required
      }
      // Check if path is explicitly secure
      else if (
        options?.securePaths?.some(
          (p) => finalPath.includes(p) || internalPath.includes(p)
        )
      ) {
        endpointSecurity = options.security || this.spec.security; // Use specified or global security
      }
      // Use router-level security setting
      else if (options?.security !== undefined) {
        endpointSecurity = options.security;
      }
      // Otherwise, don't set security (will inherit global if it exists)

      // Apply security to operation
      if (endpointSecurity === false) {
        operation.security = []; // Explicitly no authentication
      } else if (endpointSecurity) {
        operation.security = endpointSecurity;
      }
      // If undefined, don't set operation.security (inherits global)

      // Add path parameters (from the final external path)
      const pathParams = finalPath.match(/\{(\w+)\}/g);
      if (pathParams) {
        operation.parameters = pathParams.map((param) => ({
          name: param.slice(1, -1), // Remove { }
          in: "path",
          required: true,
          schema: { type: "string" },
        }));
      }

      // Add request body for POST, PUT, PATCH
      if (["post", "put", "patch"].includes(method) && schemaRef) {
        operation.requestBody = {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: `#/components/schemas/${schemaRef}` },
            },
          },
        };
      }

      // Add response schema
      if (schemaRef) {
        operation.responses["200"].content = {
          "application/json": {
            schema:
              method === "get" && !finalPath.match(/\{(\w+)\}/)
                ? {
                    type: "array",
                    items: { $ref: `#/components/schemas/${schemaRef}` },
                  }
                : { $ref: `#/components/schemas/${schemaRef}` },
          },
        };
      }

      // Add standard error responses
      if (pathParams || ["post", "put", "patch", "delete"].includes(method)) {
        operation.responses["404"] = { description: "Not found" };
      }
      if (["post", "put", "patch"].includes(method)) {
        operation.responses["400"] = { description: "Bad request" };
      }

      // Add 401 Unauthorized if security is required
      if (
        endpointSecurity !== false &&
        (endpointSecurity || this.spec.security)
      ) {
        operation.responses["401"] = {
          description: "Unauthorized - Authentication required",
        };
      }

      this.spec.paths![finalPath][method] = operation;
    });
  }

  /**
   * Add multiple routers at once
   */
  public addRouters(
    routers: Array<{
      router: Router;
      basePath: string;
      options?: {
        tags?: string[];
        schemaRefs?: Record<string, string>;
        descriptions?: Record<string, string>;
        summaries?: Record<string, string>;
        excludePaths?: string[];
        excludeMethods?: string[];
      };
    }>
  ): void {
    routers.forEach(({ router, basePath, options }) => {
      this.addRouterPaths(router, basePath, options);
    });
  }

  /**
   * Add a security scheme to the OpenAPI specification
   */
  public addSecurityScheme(
    name: string,
    scheme: {
      type: "apiKey" | "http" | "oauth2" | "openIdConnect";
      description?: string;
      name?: string; // For apiKey
      in?: "query" | "header" | "cookie"; // For apiKey
      scheme?: string; // For http (e.g., 'bearer', 'basic')
      bearerFormat?: string; // For http bearer (e.g., 'JWT')
      flows?: any; // For oauth2
      openIdConnectUrl?: string; // For openIdConnect
    }
  ): void {
    if (!this.spec.components.securitySchemes) {
      this.spec.components.securitySchemes = {};
    }

    this.spec.components.securitySchemes[name] = scheme;
  }

  /**
   * Add multiple security schemes at once
   */
  public addSecuritySchemes(schemes: Record<string, any>): void {
    Object.entries(schemes).forEach(([name, scheme]) => {
      this.addSecurityScheme(name, scheme);
    });
  }

  /**
   * Set global security requirements for all endpoints
   */
  public setGlobalSecurity(
    securityRequirements: Array<Record<string, string[]>>
  ): void {
    this.spec.security = securityRequirements;
  }

  /**
   * Add bearer token authentication (convenience method)
   */
  public addBearerAuth(
    schemeName: string = "bearerAuth",
    bearerFormat: string = "JWT",
    description?: string
  ): void {
    this.addSecurityScheme(schemeName, {
      type: "http",
      scheme: "bearer",
      bearerFormat,
      description: description || "Bearer token authentication",
    });

    // Set as global security requirement
    this.setGlobalSecurity([{ [schemeName]: [] }]);
  }

  /**
   * Add API key authentication (convenience method)
   */
  public addApiKeyAuth(
    schemeName: string = "apiKey",
    keyName: string = "X-API-Key",
    location: "query" | "header" | "cookie" = "header",
    description?: string
  ): void {
    this.addSecurityScheme(schemeName, {
      type: "apiKey",
      name: keyName,
      in: location,
      description: description || "API key authentication",
    });

    // Set as global security requirement
    this.setGlobalSecurity([{ [schemeName]: [] }]);
  }

  /**
   * Clear all security schemes and requirements
   */
  public clearSecurity(): void {
    delete this.spec.components.securitySchemes;
    delete this.spec.security;
  }

  /**
   * Add reusable parameters to components
   */
  public addParameters(parameters: Record<string, any>): void {
    if (!this.spec.components.parameters) {
      this.spec.components.parameters = {};
    }
    Object.assign(this.spec.components.parameters, parameters);
  }

  /**
   * Add reusable headers to components
   */
  public addHeaders(headers: Record<string, any>): void {
    if (!this.spec.components.headers) {
      this.spec.components.headers = {};
    }
    Object.assign(this.spec.components.headers, headers);
  }

  /**
   * Add reusable responses to components
   */
  public addResponses(responses: Record<string, any>): void {
    if (!this.spec.components.responses) {
      this.spec.components.responses = {};
    }
    Object.assign(this.spec.components.responses, responses);
  }

  /**
   * Add standard OpenAPI components (parameters, headers, responses, error schemas)
   */
  public addStandardComponents(): void {
    // Add standard parameters
    this.addParameters({
      limit: {
        name: "limit",
        description: "The number of items to return",
        in: "query",
        required: false,
        schema: {
          type: "integer",
          format: "int64",
          default: 10,
        },
      },
      offset: {
        name: "offset",
        description: "The number of items to skip",
        in: "query",
        required: false,
        schema: {
          type: "integer",
          format: "int64",
          default: 0,
        },
      },
    });

    // Add standard headers
    this.addHeaders({
      "X-RateLimit-Limit": {
        description: "The number of allowed requests in the current period",
        schema: { type: "integer", example: 100 },
      },
      "X-RateLimit-Remaining": {
        description: "The number of remaining requests in the current period",
        schema: { type: "integer", example: 95 },
      },
      "X-RateLimit-Reset": {
        description: "The number of seconds left in the current period",
        schema: { type: "integer", example: 3600 },
      },
      "X-Request-ID": {
        description: "Unique identifier for the request",
        schema: {
          type: "string",
          format: "uuid",
          example: "123e4567-e89b-12d3-a456-426614174000",
        },
      },
      "X-Pagination-Total": {
        description: "Total number of items available",
        schema: { type: "integer", example: 1000 },
      },
      "X-Pagination-Page": {
        description: "Current page number",
        schema: { type: "integer", example: 1 },
      },
      "X-Pagination-Per-Page": {
        description: "Number of items per page",
        schema: { type: "integer", example: 10 },
      },
      "X-Processing-Time": {
        description: "The time taken to process the request in milliseconds",
        schema: { type: "integer", example: 150 },
      },
    });

    // Add error schemas
    const errorSchemas = {
      BadRequestError: {
        "x-scalar-ignore": true,
        description: "RFC 7807 (https://datatracker.ietf.org/doc/html/rfc7807)",
        type: "object",
        properties: {
          type: {
            type: "string",
            examples: ["https://example.com/errors/bad-request"],
          },
          title: { type: "string", examples: ["Bad Request"] },
          status: { type: "integer", format: "int64", examples: [400] },
          detail: { type: "string", examples: ["The request was invalid."] },
        },
      },
      UnauthorizedError: {
        "x-scalar-ignore": true,
        description: "Error response for unauthorized access (RFC 7807)",
        type: "object",
        properties: {
          type: {
            type: "string",
            examples: ["https://example.com/errors/unauthorized"],
          },
          title: { type: "string", examples: ["Unauthorized"] },
          status: { type: "integer", format: "int64", examples: [401] },
          detail: {
            type: "string",
            examples: ["You are not authorized to access this resource."],
          },
        },
      },
      ForbiddenError: {
        "x-scalar-ignore": true,
        description: "Error response for forbidden access (RFC 7807)",
        type: "object",
        properties: {
          type: {
            type: "string",
            examples: ["https://example.com/errors/forbidden"],
          },
          title: { type: "string", examples: ["Forbidden"] },
          status: { type: "integer", format: "int64", examples: [403] },
          detail: {
            type: "string",
            examples: ["You are not authorized to access this resource."],
          },
        },
      },
      NotFoundError: {
        "x-scalar-ignore": true,
        description: "Error response for resource not found (RFC 7807)",
        type: "object",
        properties: {
          type: {
            type: "string",
            examples: ["https://example.com/errors/not-found"],
          },
          title: { type: "string", examples: ["Not Found"] },
          status: { type: "integer", format: "int64", examples: [404] },
          detail: {
            type: "string",
            examples: ["The resource you are trying to access does not exist."],
          },
        },
      },
      Conflict: {
        "x-scalar-ignore": true,
        description: "Error response for resource conflicts (RFC 7807)",
        type: "object",
        properties: {
          type: {
            type: "string",
            examples: ["https://example.com/errors/conflict"],
          },
          title: { type: "string", examples: ["Conflict"] },
          status: { type: "integer", format: "int64", examples: [409] },
          detail: {
            type: "string",
            examples: ["The resource you are trying to access is in conflict."],
          },
        },
      },
      UnprocessableEntity: {
        "x-scalar-ignore": true,
        description: "Error response for unprocessable entity (RFC 7807)",
        type: "object",
        properties: {
          type: {
            type: "string",
            examples: ["https://example.com/errors/unprocessable-entity"],
          },
          title: { type: "string", examples: ["Unprocessable Entity"] },
          status: { type: "integer", format: "int64", examples: [422] },
          detail: { type: "string", examples: ["The request was invalid."] },
        },
      },
      TooManyRequestsError: {
        "x-scalar-ignore": true,
        description: "Error response for rate limiting (RFC 7807)",
        type: "object",
        properties: {
          type: {
            type: "string",
            examples: ["https://example.com/errors/too-many-requests"],
          },
          title: { type: "string", examples: ["Too Many Requests"] },
          status: { type: "integer", format: "int64", examples: [429] },
          detail: {
            type: "string",
            examples: ["Rate limit exceeded. Please try again later."],
          },
        },
      },
    };

    Object.entries(errorSchemas).forEach(([name, schema]) => {
      this.spec.components.schemas[name] = schema as any;
    });

    // Add standard responses
    this.addResponses({
      BadRequest: {
        description: "Bad Request",
        headers: {
          "X-Request-ID": { $ref: "#/components/headers/X-Request-ID" },
        },
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/BadRequestError" },
          },
        },
      },
      Unauthorized: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/UnauthorizedError" },
          },
        },
      },
      Forbidden: {
        description: "Forbidden",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ForbiddenError" },
          },
        },
      },
      NotFound: {
        description: "Not Found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/NotFoundError" },
          },
        },
      },
      Conflict: {
        description: "Conflict",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Conflict" },
          },
        },
      },
      UnprocessableEntity: {
        description: "Unprocessable Entity",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/UnprocessableEntity" },
          },
        },
      },
      TooManyRequests: {
        description: "Too Many Requests",
        headers: {
          "X-Request-ID": { $ref: "#/components/headers/X-Request-ID" },
          "X-RateLimit-Limit": {
            $ref: "#/components/headers/X-RateLimit-Limit",
          },
          "X-RateLimit-Remaining": {
            $ref: "#/components/headers/X-RateLimit-Remaining",
          },
          "X-RateLimit-Reset": {
            $ref: "#/components/headers/X-RateLimit-Reset",
          },
          "Retry-After": {
            description: "The number of seconds to wait before retrying",
            schema: { type: "integer", example: 60 },
          },
        },
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/TooManyRequestsError" },
          },
        },
      },
    });
  }

  /**
   * Add a single server to the OpenAPI specification
   */
  public addServer(
    url: string,
    description?: string,
    variables?: Record<
      string,
      {
        enum?: string[];
        default: string;
        description?: string;
      }
    >
  ): void {
    if (!this.spec.servers) {
      this.spec.servers = [];
    }

    const server: OpenAPIServer = { url };
    if (description !== undefined) {
      server.description = description;
    }
    if (variables !== undefined) {
      server.variables = variables;
    }
    this.spec.servers.push(server);
  }

  /**
   * Add multiple servers at once
   */
  public addServers(
    servers: Array<{
      url: string;
      description?: string;
      variables?: Record<
        string,
        {
          enum?: string[];
          default: string;
          description?: string;
        }
      >;
    }>
  ): void {
    servers.forEach((server) =>
      this.addServer(server.url, server.description, server.variables)
    );
  }

  /**
   * Clear all servers
   */
  public clearServers(): void {
    this.spec.servers = [];
  }

  /**
   * Add a single tag to the OpenAPI specification
   */
  public addTag(
    name: string,
    description?: string | undefined,
    externalDocs?: { description?: string | undefined; url: string }
  ): void {
    if (!this.spec.tags) {
      this.spec.tags = [];
    }

    // Check if tag already exists
    const existingTag = this.spec.tags.find((tag) => tag.name === name);
    if (existingTag) {
      // Update existing tag
      if (description) existingTag.description = description;
      if (externalDocs) existingTag.externalDocs = externalDocs;
    } else {
      // Add new tag
      const newTag: OpenAPITag = {
        name,
      };
      if (description !== undefined) {
        newTag.description = description;
      }
      if (externalDocs !== undefined) {
        newTag.externalDocs = externalDocs;
      }
      this.spec.tags.push(newTag);
    }
  }

  /**
   * Add multiple tags at once
   */
  public addTags(
    tags: Array<{
      name: string;
      description?: string;
      externalDocs?: { description?: string; url: string };
    }>
  ): void {
    tags.forEach((tag) =>
      this.addTag(tag.name, tag.description, tag.externalDocs)
    );
  }

  /**
   * Get the current spec object
   */
  public getSpec(): OpenAPISpec {
    return this.spec;
  }
}

export default SequelizeToOpenAPIGenerator;
