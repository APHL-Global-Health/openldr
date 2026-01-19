# Dockerfile for APISIX with health check tools
FROM apache/apisix:3.13.0-debian

# Switch to root user to install packages
USER root

# Clean any existing locks and install packages
RUN rm -rf /var/lib/apt/lists/lock \
    && rm -rf /var/cache/apt/archives/lock \
    && rm -rf /var/lib/dpkg/lock* \
    && apt-get clean \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
    curl \
    wget \
    netcat-openbsd \
    procps \
    net-tools \
    jq \
    telnet \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Switch back to apisix user if it exists, otherwise stay as root
RUN id -u apisix >/dev/null 2>&1 && USER_CMD="USER apisix" || USER_CMD="# USER root" \
    && echo "$USER_CMD" >> /tmp/user_switch

# Apply user switch if needed
RUN if grep -q "USER apisix" /tmp/user_switch; then \
        chown -R apisix:apisix /usr/local/apisix; \
    fi

# Keep the original APISIX entrypoint and command
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["docker-start"]