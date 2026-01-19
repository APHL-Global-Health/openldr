-- Create multiple databases
CREATE DATABASE IF NOT EXISTS keycloak;

-- Grant privileges to keycloak user on all databases
GRANT ALL PRIVILEGES ON keycloak.* TO 'openldr'@'%';

FLUSH PRIVILEGES;