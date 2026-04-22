# MCP Server Guide

The OpenLDR MCP (Model Context Protocol) Server enables AI assistants to interact with your OpenLDR system through natural language. This means you can ask questions about your laboratory data, manage resources, and perform operations without writing code or using complex APIs.

## What is MCP?

Model Context Protocol (MCP) is a standard that allows AI assistants to safely interact with external systems. Think of it as a bridge that lets AI understand and work with your laboratory data in a secure, controlled way.

## Quick Start

### Accessing the MCP Server

The MCP server runs on:

- **Local**: `http://127.0.0.1:6060/mcp`
- **Remote**: `http://<your-server-ip>:6060/mcp`

### Confguration example

```json
{
  "mcpServers": {
    "openldr": {
      "type": "streamable-http",
      "url": "http://127.0.0.1:6060/mcp",
      "note": "For Streamable HTTP connections, add this URL directly in your MCP Client"
    }
  }
}
```

## Available Tools

The MCP server provides access to these capabilities:

### Health & Status

- `health_check` - Check if all services are running properly

### Database (PostgreSQL)

- `list_tables` - See all database tables
- `get_table_columns` - View table structure
- `query_data` - Search and filter data
- `insert_data` - Add new records
- `update_data` - Modify existing records
- `delete_data` - Remove records
- `upsert_data` - Insert or update records
- `count_records` - Count matching records
- `execute_sql` - Run custom SQL queries
- `bulk_update_transaction` - Update multiple records safely

### Specialized Data Queries

- `get_facilities` - Query laboratory facilities
- `get_data_feeds` - View data feed configurations
- `get_extensions` - List installed plugins
- `get_projects` - Query projects
- `get_users` - Search users

### File Storage (MinIO)

- `minio_list_buckets` - List all storage buckets
- `minio_list_files` - Browse files in a bucket
- `minio_get_file_url` - Generate download links
- `minio_get_file_info` - Get file details
- `minio_download_file` - Download and view small files
- `minio_search_files` - Search files by name

### Search & Analytics (OpenSearch)

- `opensearch_list_indices` - List search indices
- `opensearch_get_mapping` - View index structure
- `opensearch_search` - Search documents
- `opensearch_fulltext_search` - Advanced text search
- `opensearch_aggregate` - Analyze and summarize data
- `opensearch_get_document` - Get specific document
- `opensearch_count` - Count matching documents

### User Management (Keycloak)

- `keycloak_list_users` - List all users
- `keycloak_get_user` - Get user details
- `keycloak_get_user_roles` - View user permissions
- `keycloak_get_user_groups` - See group memberships
- `keycloak_list_roles` - List available roles
- `keycloak_list_groups` - List all groups
- `keycloak_get_group_members` - See group members
- `keycloak_list_clients` - List configured clients
- `keycloak_check_user_role` - Verify user permissions

### API Gateway (APISIX)

- `apisix_list_routes` - List API routes
- `apisix_get_route` - Get route details
- `apisix_create_route` - Create new route
- `apisix_update_route` - Modify existing route
- `apisix_delete_route` - Remove route
- `apisix_list_upstreams` - List backend services
- `apisix_list_services` - List configured services
- `apisix_get_status` - Check gateway status
- `apisix_add_plugin_to_route` - Add plugin to route
- `apisix_remove_plugin_from_route` - Remove plugin
- `apisix_list_plugins` - List available plugins

### Message Streaming (Kafka)

- `kafka_test_connection` - Test Kafka connectivity
- `kafka_list_topics` - List all topics
- `kafka_get_topic_metadata` - Get topic details
- `kafka_create_topic` - Create new topic
- `kafka_delete_topics` - Remove topics
- `kafka_publish_message` - Send messages
- `kafka_list_consumer_groups` - List consumer groups
- `kafka_describe_consumer_group` - Get group details
- `kafka_get_topic_offsets` - Get offset information
- `kafka_fetch_consumer_offsets` - View consumer positions
- `kafka_reset_consumer_offsets` - Reset consumer position
- `kafka_delete_consumer_groups` - Remove consumer groups
- `kafka_get_cluster_info` - Get cluster information
- `kafka_alter_topic_config` - Modify topic settings
