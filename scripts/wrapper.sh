#!/bin/bash
# wrapper.sh
# Validates that the ConfigMap script is mounted and executes it

set -e

CONFIGMAP_SCRIPT="/scripts/rightsizing.sh"

echo "=== Kubecost Rightsizing Bot ==="
echo ""

# Check if ConfigMap script exists
if [ ! -f "$CONFIGMAP_SCRIPT" ]; then
    echo "❌ ERROR: Script not found at $CONFIGMAP_SCRIPT"
    echo ""
    echo "The rightsizing script must be mounted via ConfigMap."
    echo ""
    echo "Expected mount:"
    echo "  volumeMounts:"
    echo "  - name: script-override"
    echo "    mountPath: /scripts"
    echo ""
    echo "  volumes:"
    echo "  - name: script-override"
    echo "    configMap:"
    echo "      name: kubecost-rightsizing-script"
    echo ""
    exit 1
fi

# Verify script is executable
if [ ! -x "$CONFIGMAP_SCRIPT" ]; then
    echo "⚠️  Script is not executable, setting permissions..."
    chmod +x "$CONFIGMAP_SCRIPT"
fi

echo "✓ Found script at $CONFIGMAP_SCRIPT"
echo ""

# Execute the ConfigMap script
exec "$CONFIGMAP_SCRIPT"
