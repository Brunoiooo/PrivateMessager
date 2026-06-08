#!/bin/sh
set -e

CA_FILE="/ssl/${SSL_CA_CERT_FILE:-ca.pem}"
NSC_DIR="/app/android/app/src/main/res/xml"
RAW_DIR="/app/android/app/src/main/res/raw"

mkdir -p "$NSC_DIR"

if [ -f "$CA_FILE" ]; then
  echo "[ssl] Bundling CA cert from $CA_FILE"
  mkdir -p "$RAW_DIR"
  cp "$CA_FILE" "$RAW_DIR/ca_cert.pem"

  cat > "$NSC_DIR/network_security_config.xml" << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors>
      <certificates src="system"/>
      <certificates src="@raw/ca_cert"/>
    </trust-anchors>
  </base-config>
</network-security-config>
EOF
  echo "[ssl] HTTPS mode — custom CA trusted"
else
  echo "[ssl] No CA cert found — cleartext HTTP mode"
  cat > "$NSC_DIR/network_security_config.xml" << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="true"/>
</network-security-config>
EOF
fi

npm ci
printf 'MESSAGER_API_BASE_URL=%s\n' "$MESSAGER_API_BASE_URL" > /app/.env

cd android
chmod +x gradlew
./gradlew assembleRelease --no-daemon
cp /app/android/app/build/outputs/apk/release/*.apk /releases/
