#!/bin/bash
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
CRONJOB_IMAGE="natea123/kubecost-cronjob:v1.0.0"
UI_IMAGE="natea123/kubecost-rightsizing-ui:v1.0.0"
NAMESPACE="kubecost"
UI_LOCAL_PORT="${UI_LOCAL_PORT:-8080}"

SKIP_BUILD=false
TEARDOWN=false
TRIGGER_JOB=false
GITHUB_TOKEN="${GITHUB_TOKEN:-}"

# ── Usage ─────────────────────────────────────────────────────────────────────
usage() {
  echo "Usage: $0 [options]"
  echo ""
  echo "Options:"
  echo "  --skip-build          Skip docker build (use existing local images)"
  echo "  --trigger-job         Trigger a manual job run after deployment"
  echo "  --teardown            Delete all resources and exit"
  echo "  --token=<token>       GitHub PAT (or set GITHUB_TOKEN env var)"
  echo "  --port=<port>         Local port for UI (default: 8080)"
  echo ""
}

for arg in "$@"; do
  case $arg in
    --skip-build)    SKIP_BUILD=true ;;
    --trigger-job)   TRIGGER_JOB=true ;;
    --teardown)      TEARDOWN=true ;;
    --token=*)       GITHUB_TOKEN="${arg#*=}" ;;
    --port=*)        UI_LOCAL_PORT="${arg#*=}" ;;
    --help|-h)       usage; exit 0 ;;
    *) echo "Unknown option: $arg"; usage; exit 1 ;;
  esac
done

# ── Teardown ──────────────────────────────────────────────────────────────────
if [ "$TEARDOWN" = true ]; then
  echo "==> Tearing down e2e environment..."
  kubectl delete namespace "$NAMESPACE" --ignore-not-found
  kubectl delete clusterrole kubecost-rightsizing --ignore-not-found
  kubectl delete clusterrolebinding kubecost-rightsizing --ignore-not-found
  echo "Done."
  exit 0
fi

# ── Prerequisites ─────────────────────────────────────────────────────────────
echo "==> Checking prerequisites..."
if ! command -v docker &>/dev/null; then
  echo "ERROR: 'docker' is not installed or not in PATH"
  exit 1
fi

# ── Build ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ "$SKIP_BUILD" = false ]; then
  echo "==> Building cronjob image (${CRONJOB_IMAGE})..."
  docker build -t "$CRONJOB_IMAGE" "$REPO_ROOT"

  echo "==> Building UI image (${UI_IMAGE})..."
  docker build -t "$UI_IMAGE" "$REPO_ROOT/ui"
fi

# ── Namespace ─────────────────────────────────────────────────────────────────
echo "==> Creating namespace '${NAMESPACE}'..."
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

# ── GitHub secret ─────────────────────────────────────────────────────────────
if [ -n "$GITHUB_TOKEN" ]; then
  echo "==> Updating github-pat secret..."
  kubectl create secret generic github-pat \
    --namespace "$NAMESPACE" \
    --from-literal=token="$GITHUB_TOKEN" \
    --dry-run=client -o yaml | kubectl apply -f -
elif kubectl get secret github-pat -n "$NAMESPACE" &>/dev/null; then
  echo "==> github-pat secret already exists, leaving it unchanged."
else
  echo ""
  echo "WARNING: No GITHUB_TOKEN provided and no existing github-pat secret found."
  echo "  Cronjob runs will fail at git clone."
  echo "  Pass --token=<token> or set the GITHUB_TOKEN env var."
  echo ""
fi

# ── Apply manifests ───────────────────────────────────────────────────────────
echo "==> Applying cronjob manifest..."
sed "s|your-registry.io/kubecost-rightsizing:v1.0.0|${CRONJOB_IMAGE}|g" \
  "$REPO_ROOT/cronjob.yaml" | kubectl apply -f -

echo "==> Applying UI manifest..."
kubectl apply -f "$REPO_ROOT/ui/ui-deployment.yaml"

# ── Wait for UI ───────────────────────────────────────────────────────────────
echo "==> Waiting for UI deployment to be ready (timeout: 120s)..."
kubectl rollout status deployment/kubecost-rightsizing-ui \
  -n "$NAMESPACE" --timeout=120s

# ── Trigger a manual job run ──────────────────────────────────────────────────
if [ "$TRIGGER_JOB" = true ]; then
  echo "==> Triggering manual job run..."
  JOB_NAME="kubecost-rightsizing-e2e-$(date +%Y%m%d-%H%M%S)"
  kubectl create job "$JOB_NAME" \
    --from=cronjob/kubecost-rightsizing \
    -n "$NAMESPACE"
  echo "    Job '${JOB_NAME}' created. Waiting up to 60s for it to start..."
  kubectl wait pod \
    --for=condition=Ready \
    --selector="job-name=${JOB_NAME}" \
    -n "$NAMESPACE" \
    --timeout=60s 2>/dev/null || true
  echo "    Logs:"
  kubectl logs -n "$NAMESPACE" -l "job-name=${JOB_NAME}" --tail=50 2>/dev/null || \
    echo "    (logs not yet available)"
fi

# ── Status ────────────────────────────────────────────────────────────────────
echo ""
echo "==> Cluster status:"
kubectl get all -n "$NAMESPACE"

# ── Port-forward ──────────────────────────────────────────────────────────────
echo ""
echo "==> UI available at http://localhost:${UI_LOCAL_PORT}"
echo "    Press Ctrl+C to stop port-forwarding."
echo ""
kubectl port-forward -n "$NAMESPACE" \
  svc/kubecost-rightsizing-ui "${UI_LOCAL_PORT}:80"
