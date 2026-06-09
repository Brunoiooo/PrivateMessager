#!/bin/sh

# Generate nginx configuration based on environment variables
# Supports both SSL and non-SSL modes on a single configurable port

USE_SSL="${NGINX_USE_SSL:-true}"
APP_PORT="${APP_PORT:-443}"

# Start building the config
cat > /tmp/nginx.conf << 'EOF'
events {}

http {
  server {
    listen $APP_PORT ssl;
    server_name _;

    ssl_certificate     /etc/ssl/messager/server.pem;
    ssl_certificate_key /etc/ssl/messager/server-key.pem;

    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    location / {
      proxy_pass         http://api:5000;
      proxy_http_version 1.1;
      proxy_set_header   Upgrade $http_upgrade;
      proxy_set_header   Connection "upgrade";
      proxy_set_header   Host $host;
      proxy_read_timeout 3600s;
    }
  }
}
EOF

# If SSL is disabled, generate non-SSL config
if [ "$USE_SSL" != "true" ] && [ "$USE_SSL" != "1" ]; then
  cat > /tmp/nginx.conf << 'EOF'
events {}

http {
  server {
    listen $APP_PORT;
    server_name _;

    location / {
      proxy_pass         http://api:5000;
      proxy_http_version 1.1;
      proxy_set_header   Upgrade $http_upgrade;
      proxy_set_header   Connection "upgrade";
      proxy_set_header   Host $host;
      proxy_read_timeout 3600s;
    }
  }
}
EOF
fi

# Substitute environment variables
envsubst '$APP_PORT' < /tmp/nginx.conf > /etc/nginx/nginx.conf

echo "nginx config generated: port=$APP_PORT, ssl=$USE_SSL"

