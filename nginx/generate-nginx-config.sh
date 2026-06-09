#!/bin/sh

# Generate nginx configuration based on environment variables
# Supports both SSL and non-SSL modes

USE_SSL="${NGINX_USE_SSL:-true}"
API_PORT="${API_BIND_PORT}"
EXTERNAL_PORT="${NGINX_EXTERNAL_PORT:-443}"

# Start building the config
cat > /tmp/nginx.conf << 'EOF'
events {}

http {
  # Non-SSL HTTP server
  server {
    listen 80;
    server_name _;

    location / {
      proxy_pass         http://api:$API_PORT;
      proxy_http_version 1.1;
      proxy_set_header   Upgrade $http_upgrade;
      proxy_set_header   Connection "upgrade";
      proxy_set_header   Host $host;
      proxy_read_timeout 3600s;
    }
  }

EOF

# Add SSL server block only if SSL is enabled
if [ "$USE_SSL" = "true" ] || [ "$USE_SSL" = "1" ]; then
  cat >> /tmp/nginx.conf << 'EOF'
  # SSL HTTPS server
  server {
    listen $EXTERNAL_PORT ssl;
    server_name _;

    ssl_certificate     /etc/ssl/messager/server.pem;
    ssl_certificate_key /etc/ssl/messager/server-key.pem;

    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    location / {
      proxy_pass         http://api:$API_PORT;
      proxy_http_version 1.1;
      proxy_set_header   Upgrade $http_upgrade;
      proxy_set_header   Connection "upgrade";
      proxy_set_header   Host $host;
      proxy_read_timeout 3600s;
    }
  }
EOF
fi

cat >> /tmp/nginx.conf << 'EOF'
}
EOF

# Substitute environment variables
envsubst '$API_PORT,$EXTERNAL_PORT' < /tmp/nginx.conf > /etc/nginx/nginx.conf

echo "nginx config generated with USE_SSL=$USE_SSL"
