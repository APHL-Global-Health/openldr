# Extension Development Guide

OpenLDR features a powerful VSCode-style extension system that allows you to customize and extend the platform's functionality. This guide will help you create, publish, and manage extensions for the OpenLDR marketplace.

## Table of Contents

- [What Are Extensions?](#what-are-extensions)
- [Getting Started](#getting-started)
- [Extension Structure](#extension-structure)
- [Manifest File](#manifest-file)
- [Extension Code](#extension-code)
- [SDK Reference](#sdk-reference)
- [Publishing Extensions](#publishing-extensions)
- [Best Practices](#best-practices)
- [Examples](#examples)

## What Are Extensions?

Extensions are packages that add new features and functionality to OpenLDR. They can:

- Add new UI components and views
- Integrate with external systems (LIMS, EHR, etc.)
- Process and transform data
- Provide custom visualizations
- Automate workflows
- Extend the API with new endpoints

## Getting Started

### Prerequisites

- Node.js 24+ installed
- TypeScript knowledge (recommended)
- Familiarity with React (for UI extensions)
- OpenLDR development environment set up
- Use example provided from repo

## Extension Structure

Every extension consists of two required files:

```
my-extension/
├── manifest.json    # Extension metadata and configuration
└── index.js         # Extension code and logic
```

## Manifest File

The `manifest.json` file defines your extension's metadata, permissions, and capabilities.

### Required Fields

```json
{
  "id": "org.yourorg.extension.name",
  "name": "Extension Display Name",
  "version": "1.0.0",
  "description": "Brief description of what your extension does",
  "author": "Your Name or Organization",
  "main": "index.js"
}
```

### Complete Manifest Example

```json
{
  "id": "org.example.lab.integration",
  "name": "Lab System Integration",
  "publisher": {
    "displayName": "Example Labs Inc",
    "domain": "example.com"
  },
  "icon": {
    "menu": "<Microscope />",
    "package": "data:image/svg+xml;base64,..."
  },
  "description": "Integrates with external laboratory information systems",
  "version": "1.2.0",
  "lastUpdated": "2025-01-15",
  "author": "Example Labs Inc",
  "main": "index.js",
  "permissions": ["data.read", "data.write", "network.http"],
  "contributes": {
    "commands": [
      {
        "command": "labIntegration.sync",
        "title": "Sync Lab Data"
      }
    ],
    "views": [
      {
        "id": "lab-results-view",
        "name": "Lab Results",
        "slot": "sidebar"
      }
    ]
  },
  "activationEvents": ["onStartup"],
  "license": "Apache 2.0",
  "repository": "https://github.com/example/lab-integration",
  "categories": ["Data Integration", "Laboratory"],
  "tags": ["lab", "integration", "sync", "results"],
  "readme": "# Lab System Integration\n\nThis extension...",
  "features": "- Real-time sync\n- Automated workflows\n- Error handling",
  "changelog": "## [1.2.0]\n- Added support for HL7 v2.7\n- Fixed sync issues"
}
```

### Manifest Field Reference

#### Core Fields

| Field         | Type   | Required | Description                                 |
| ------------- | ------ | -------- | ------------------------------------------- |
| `id`          | string | Yes      | Unique identifier (reverse domain notation) |
| `name`        | string | Yes      | Display name for the extension              |
| `version`     | string | Yes      | Semantic version (e.g., "1.2.3")            |
| `description` | string | Yes      | Short description (max 200 chars)           |
| `author`      | string | Yes      | Extension author or organization            |
| `main`        | string | Yes      | Entry point file (usually "index.js")       |

#### Publisher Information

```json
"publisher": {
  "displayName": "Organization Name",
  "domain": "example.com"
}
```

#### Icons

Icons can be specified as Lucide React components or base64-encoded SVG:

```json
"icon": {
  "menu": "<IconName />",
  "package": "data:image/svg+xml;base64,..."
}
```

#### Permissions

Declare what resources your extension needs access to:

```json
"permissions": [
  "data.read",           // Read database data
  "data.write",          // Write to database
  "storage.read",        // Read from MinIO
  "storage.write",       // Write to MinIO
  "network.http",        // Make HTTP requests
  "network.kafka",       // Access Kafka
  "search.read",         // Query OpenSearch
  "search.write",        // Index to OpenSearch
  "auth.users",          // Access user information
  "api.routes"           // Register API routes
]
```

#### Activation Events

Control when your extension loads:

```json
"activationEvents": [
  "onStartup",                    // Load on app start
  "onCommand:extension.command",  // Load when command runs
  "onView:viewId",                // Load when view opens
  "onLanguage:typescript"         // Load for specific file types
]
```

#### Categories

Available categories:

- `Data Integration`
- `Laboratory`
- `Visualization`
- `Analytics`
- `Workflow Automation`
- `Security`
- `Reporting`
- `Utilities`
- `Debuggers`
- `Other`

## Extension Code

The `index.js` file contains your extension's logic and must export a default object with `activate` and `deactivate` functions.

### Basic Template

```typescript
// Access the OpenLDR SDK
const _window_ = window as any;
const sdk = _window_.__OPENLDR_SDK__;
const exts = sdk.extensions;
const types = exts.types;
const React = sdk.react;

const MyExtension: typeof types.Extension = {
  id: "org.example.extension",
  name: "My Extension",
  version: "1.0.0",

  activate: async (context: typeof types.ExtensionContext) => {
    // Extension initialization code
    console.log("Extension activated!");

    // Your code here
  },

  deactivate: async () => {
    // Cleanup code
    console.log("Extension deactivated!");
  },
};

export default MyExtension;
```

### Extension Context

The `context` parameter provides access to extension lifecycle and storage:

```typescript
activate: async (context) => {
  // Store data that persists across sessions
  await context.globalState.update("key", "value");
  const value = context.globalState.get("key");

  // Register disposables for cleanup
  context.subscriptions.push(disposable);
};
```

## SDK Reference

The OpenLDR SDK provides APIs to interact with the platform.

### Accessing the SDK

```typescript
const sdk = window.__OPENLDR_SDK__;
```

### Available APIs

#### Commands API

Register and execute commands:

```typescript
// Register a command
const disposable = sdk.api.commands.registerCommand(
  "myExtension.doSomething",
  () => {
    console.log("Command executed!");
  },
);

// Execute a command
await sdk.api.commands.executeCommand("myExtension.doSomething");
```

#### UI API

Register custom UI components:

```typescript
const MyComponent = () => {
  return React.createElement("div", {}, "Hello from my extension!");
};

const uiDisposable = sdk.api.ui.registerUIComponent({
  id: "my-custom-view",
  extensionId: "org.example.extension",
  component: MyComponent,
  slot: "sidebar", // only one implemented so far
});

context.subscriptions.push(uiDisposable);
```

#### Data API

Access and manipulate data:

```typescript
// Get facilities
const { count, rows } = await sdk.api.data.facilities.getAll();

// Get data feeds
const feeds = await sdk.api.data.feeds.getAll();

// Submit data for processing
await sdk.api.data.processing.feedEntry(data, dataFeedId);

// Get projects
const projects = await sdk.api.data.projects.getAll();

// Get users
const users = await sdk.api.data.users.getAll();
```

#### Storage API

Work with file storage:

```typescript
// Upload file
await sdk.api.storage.upload(bucket, filename, data);

// Download file
const file = await sdk.api.storage.download(bucket, filename);

// List files
const files = await sdk.api.storage.list(bucket, prefix);
```

#### Search API

Query OpenSearch:

```typescript
// Search documents
const results = await sdk.api.search.query(index, query);

// Get document
const doc = await sdk.api.search.get(index, id);

// Index document
await sdk.api.search.index(index, id, document);
```

#### Events API

Publish and subscribe to events:

```typescript
// Subscribe to events
const subscription = sdk.api.events.subscribe("data.uploaded", (event) => {
  console.log("File uploaded:", event.data);
});

// Publish events
await sdk.api.events.publish("custom.event", { data: "value" });

// Unsubscribe
subscription.unsubscribe();
```

## Publishing Extensions

### Preparing for Publication

1. **Test thoroughly**
   - Test in local development environment
   - Verify all features work as expected
   - Check for errors in browser console

2. **Update documentation**
   - Complete the `readme` field in manifest
   - Document all features in `features` field
   - Update `changelog` with version changes

3. **Package your extension**
   - Create a zip file with manifest.json and index.js

## Best Practices

### Security

- **Request minimal permissions** - Only ask for permissions you actually need
- **Validate inputs** - Always validate data from users and external sources
- **Sanitize outputs** - Prevent XSS by sanitizing any HTML output
- **Use HTTPS** - Always use secure connections for external APIs
- **Handle secrets properly** - Never hardcode API keys or credentials

### Performance

- **Lazy load resources** - Only load what you need, when you need it
- **Debounce expensive operations** - Avoid excessive API calls
- **Clean up resources** - Dispose of subscriptions and listeners
- **Optimize renders** - Use React best practices for UI components
- **Cache when appropriate** - Store frequently accessed data

### User Experience

- **Provide feedback** - Show loading states and error messages
- **Handle errors gracefully** - Don't let errors crash the app
- **Follow UI patterns** - Match OpenLDR's design language
- **Document features** - Include clear instructions for users
- **Support dark mode** - Detect and adapt to theme changes

### Code Quality

```typescript
// Good: Clear naming and error handling
const fetchFacilityData = async (facilityId: string) => {
  try {
    const facility = await sdk.api.data.facilities.get(facilityId);
    return facility;
  } catch (error) {
    console.error("Failed to fetch facility:", error);
    throw new Error(`Could not load facility ${facilityId}`);
  }
};

// Bad: Vague naming and no error handling
const get = async (id: string) => {
  return await sdk.api.data.facilities.get(id);
};
```

### Disposal Pattern

Always clean up resources in the deactivate function:

```typescript
activate: async (context) => {
  const commandDisposable = sdk.api.commands.registerCommand(...);
  const uiDisposable = sdk.api.ui.registerUIComponent(...);
  const eventSubscription = sdk.api.events.subscribe(...);

  // Add to subscriptions for automatic cleanup
  context.subscriptions.push(
    commandDisposable,
    uiDisposable,
    eventSubscription
  );
}
```

## Examples

### Example: Simple Data Display Extension

Creates a sidebar view that displays facility count:

```typescript
const FacilityCounter: typeof types.Extension = {
  id: "org.example.facility.counter",
  name: "Facility Counter",
  version: "1.0.0",

  activate: async (context) => {
    const FacilityCountView = () => {
      const [count, setCount] = React.useState(0);

      React.useEffect(() => {
        const loadCount = async () => {
          const { count } = await sdk.api.data.facilities.getAll();
          setCount(count);
        };
        loadCount();
      }, []);

      return React.createElement(
        "div",
        {
          className: "p-4",
        },
        `Total Facilities: ${count}`,
      );
    };

    const uiDisposable = sdk.api.ui.registerUIComponent({
      id: "facility-count-view",
      extensionId: "org.example.facility.counter",
      component: FacilityCountView,
      slot: "sidebar",
    });

    context.subscriptions.push(uiDisposable);
  },

  deactivate: async () => {},
};

export default FacilityCounter;
```

### Getting Help

- Review example extensions in the repo
- Ask in [GitHub Discussions](https://github.com/APHL-Global-Health/openldr/discussions)
- Report bugs on [GitHub Issues](https://github.com/APHL-Global-Health/openldr/issues)

## Resources

- [Architecture Overview](./docs/architecture.md)
- [Contributing Guide](../docs/contributing.md)
- [Example Extensions](https://github.com/APHL-Global-Health/openldr/tree/main/apps/openldr-extensions-example)

## License

Extensions must specify their license in the manifest. We recommend:

- Apache License 2.0
- MIT License

Ensure your extension's license is compatible with OpenLDR's Apache 2.0 license.
