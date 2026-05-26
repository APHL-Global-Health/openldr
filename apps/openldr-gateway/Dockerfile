# FROM nginx:1.29-alpine
FROM uozi/nginx-ui:latest

# Install njs module and dos2unix
# RUN apk add --no-cache nginx-module-njs dos2unix
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx-module-njs dos2unix \
    && rm -rf /var/lib/apt/lists/*

# Ensure njs module is loaded
RUN echo "load_module modules/ngx_http_js_module.so;" > /etc/nginx/modules.conf

# Copy files
COPY nginx.conf.template /tmp/nginx/nginx.conf.template
COPY auth.js /etc/nginx/appdata/auth.js
COPY app.ini /etc/nginx-ui/app.ini
COPY database.db /etc/nginx-ui/database.db
COPY docker-entrypoint.sh /docker-entrypoint.sh

# Fix line endings and make executable
RUN dos2unix /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

EXPOSE 80 443
ENTRYPOINT ["/docker-entrypoint.sh"]