# Kubecost ArgoCD Resource Rightsizing Automation

Automatically optimize Kubernetes resource requests in your ArgoCD repositories using real usage data from Kubecost. This CronJob creates pull requests with right-sized resource recommendations, helping you reduce cloud costs while maintaining performance.

## 🎯 What It Does

1. **Scans** your ArgoCD repository for Kubernetes workloads
2. **Queries** Kubecost for resource recommendations based on actual usage
3. **Updates** resource requests in your YAML files
4. **Creates** a GitHub Pull Request with the changes
5. **Runs** on a schedule (weekly by default)

## ✨ Features

- 🔄 **Automated optimization** - Set it and forget it
- 📊 **Data-driven recommendations** - Based on actual usage, not guesses
- 🔍 **GitOps-friendly** - Works with your existing ArgoCD workflow
- 📝 **Detailed PR descriptions** - See exactly what changed and why
- ⚙️ **Highly configurable** - Adjust targets, windows, and schedules
- 🛡️ **Safe** - Creates PRs for review, never commits directly
- 🔐 **Secure** - Runs as non-root with minimal permissions

## 📋 Prerequisites

- Kubernetes cluster (1.24+)
- [Kubecost](https://www.kubecost.com/) installed and collecting metrics
- ArgoCD repository on GitHub
- GitHub Personal Access Token with repository write permissions

## 🚀 Quick Start

### 1. Build and Push Container Image

```bash
# Clone the repository
git clone https://github.com/nandrews-ibm/kubecost-rightsizing-cronjob.git
cd kubecost-rightsizing-cronjob

# Build multi-architecture image
docker buildx build --platform linux/amd64,linux/arm64 \
  -f Dockerfile \
  -t your-registry.io/kubecost-rightsizing:v1.0.0 \
  --push .

# Or build for your specific architecture only
docker build -f Dockerfile \
  -t your-registry.io/kubecost-rightsizing:v1.0.0 .
docker push your-registry.io/kubecost-rightsizing:v1.0.0
```

**What gets built into the image:**
- ✅ Tools: bash, git, curl, jq, yq
- ✅ Wrapper script: `scripts/wrapper.sh` (validates ConfigMap)
- ❌ Rightsizing script: NOT included (comes from ConfigMap at runtime)

This means you can update the rightsizing logic by editing the ConfigMap without rebuilding the container!

### 2. Create GitHub Personal Access Token

Create a fine-grained token with these permissions:
- **Repository access**: Your ArgoCD repository
- **Permissions**:
  - Contents: **Read and write**
  - Pull requests: **Read and write**

[Create token →](https://github.com/settings/personal-access-tokens/new)

### 3. Configure and Deploy

```bash
# Edit the configuration
vim cronjob.yaml

# Update these values:
# 1. Container image: your-registry.io/kubecost-rightsizing:v1.0.0
# 2. GitHub token: Replace 'ghp_your_github_personal_access_token_here'
# 3. GIT_REPO_URL: Your ArgoCD repository URL
# 4. KUBECOST_ADDRESS: Your Kubecost endpoint (if different)

# Deploy everything (namespace, RBAC, secret, configmap, cronjob)
kubectl apply -f cronjob.yaml
```

### 4. Test It

```bash
# Create a one-time job to test
kubectl create job --from=cronjob/kubecost-rightsizing manual-test -n kubecost

# Watch the logs
kubectl logs -f job/manual-test -n kubecost
```

Within a few minutes, you should see a new Pull Request in your GitHub repository!

## 📦 What's Included

```
.
├── cronjob.yaml              # Complete deployment (all-in-one)
├── scripts/         
│   └── wrapper.sh            # Validation script (goes in container)
├── Dockerfile                # Container with tools + wrapper
```

**How it works:**
- **Container image**: Contains only tools (bash, git, curl, jq, yq) and wrapper script
- **ConfigMap**: Contains the rightsizing script (easy to edit without rebuilding)
- **Wrapper**: Validates ConfigMap is mounted and executes the script


### Update Deployment

After building and pushing, update the image in `cronjob.yaml`:

```yaml
containers:
- name: rightsizing-bot
  image: your-registry.io/kubecost-rightsizing:v1.0.0  # ← Update this
```

## ⚙️ Configuration

Configure via environment variables in the CronJob:

| Variable | Default | Description |
|----------|---------|-------------|
| `KUBECOST_ADDRESS` | `http://kubecost-frontend.kubecost:9090/model` | Kubecost API endpoint |
| `GIT_REPO_URL` | *(required)* | GitHub repository URL |
| `GIT_BRANCH` | `main` | Base branch for PRs |
| `GIT_USER_NAME` | `Kubecost Bot` | Git commit author name |
| `GIT_USER_EMAIL` | `kubecost-bot@example.com` | Git commit author email |
| `TARGET_CPU_UTIL` | `0.65` | Target CPU utilization (65%) |
| `TARGET_RAM_UTIL` | `0.65` | Target memory utilization (65%) |
| `WINDOW` | `3d` | Analysis window (3 days) |

### Example Configurations

#### Conservative (More Headroom)
```yaml
env:
- name: TARGET_CPU_UTIL
  value: "0.50"  # 50% = more headroom
- name: TARGET_RAM_UTIL
  value: "0.50"
- name: WINDOW
  value: "7d"    # Longer window = more stable
```

#### Aggressive (Cost Optimization)
```yaml
env:
- name: TARGET_CPU_UTIL
  value: "0.80"  # 80% = less headroom
- name: TARGET_RAM_UTIL
  value: "0.80"
- name: WINDOW
  value: "3d"
```

## 📅 Schedule

Default: **Every Monday at 2 AM**

```yaml
schedule: "0 2 * * 1"  # Cron format: minute hour day month weekday
```

Common alternatives:
```yaml
schedule: "0 2 * * *"     # Daily at 2 AM
schedule: "0 2 * * 0,3"   # Sunday and Wednesday at 2 AM
schedule: "0 2 1 * *"     # First day of month at 2 AM
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Kubernetes CronJob                      │
│                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │   Clone     │ -> │  Query       │ -> │  Update      │    │
│  │   ArgoCD    │    │  Kubecost    │    │  YAML Files  │    │
│  │   Repo      │    │  API         │    │              │    │
│  └─────────────┘    └──────────────┘    └──────────────┘    │
│         │                   │                    │          │
│         v                   v                    v          │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │   GitHub    │    │  Kubecost    │    │   Push       │    │
│  │   Token     │    │  Service     │    │   Branch     │    │
│  │   (Secret)  │    │              │    │              │    │
│  └─────────────┘    └──────────────┘    └──────────────┘    │
│                                                  │          │
│                                                  v          │
│                                          ┌──────────────┐   │
│                                          │   Create     │   │
│                                          │   Pull       │   │
│                                          │   Request    │   │
│                                          └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Example Pull Request

The automation creates detailed PRs like this:

```markdown
## Kubecost Resource Rightsizing Recommendations

This PR applies resource request recommendations from Kubecost based on actual usage patterns.

### Changes Summary
- `production/api-server/app`: CPU: 500m → 250m, Memory: 1Gi → 512Mi
- `production/api-server/sidecar`: CPU: 200m → 150m, Memory: 256Mi → 200Mi
- `staging/frontend/nginx`: CPU: 100m → 75m, Memory: 128Mi → 100Mi

### Analysis Parameters
- **Window**: 3d
- **Target CPU Utilization**: 0.65
- **Target RAM Utilization**: 0.65
- **Algorithm**: max

### Next Steps
- Review the recommended changes
- Verify the changes align with your performance requirements
- Merge when ready
```

## 🎨 Customization

### Editing the Script

The script is stored in a ConfigMap within `cronjob.yaml`. To customize:

1. **Edit the ConfigMap section** in the YAML file
2. **Apply the changes**: `kubectl apply -f cronjob.yaml`
3. **Test**: `kubectl create job --from=cronjob/kubecost-rightsizing test -n kubecost`

No container rebuild needed! The ConfigMap mounts the script at `/scripts/rightsizing.sh`.

### Changing Configuration

All settings are controlled via environment variables in the CronJob:

```yaml
env:
- name: TARGET_CPU_UTIL
  value: "0.50"  # More conservative
- name: WINDOW
  value: "7d"    # Longer analysis window
```

See the Configuration table above for all available options.

## 🔍 Monitoring

### Check CronJob Status

```bash
# View CronJob
kubectl get cronjob kubecost-rightsizing -n kubecost

# View recent jobs
kubectl get jobs -n kubecost -l app=kubecost-rightsizing

# View logs from last run
kubectl logs -n kubecost -l app=kubecost-rightsizing --tail=100
```


## 🐛 Troubleshooting

### Job Fails with "No GitHub token"

```bash
# Verify secret exists
kubectl get secret github-pat -n kubecost

# Check secret has correct key
kubectl get secret github-pat -n kubecost -o jsonpath='{.data.token}' | base64 -d
```

### Job Fails with "403 Forbidden"

Your GitHub token needs write permissions:
- Go to token settings
- Add **Contents: Read and write** permission
- Regenerate and update secret

### No Recommendations Found

Kubecost needs time to collect metrics:
- Wait 3 days (default `WINDOW`)
- Or reduce `WINDOW` to `1h` for testing
- Verify pods are running: `kubectl get pods -n <namespace>`

### Can't Reach Kubecost API

```bash
# Test from inside cluster
kubectl run test --rm -it --image=curlimages/curl --restart=Never -- \
  curl http://kubecost-frontend.kubecost:9090/model/savings/requestSizingV2?window=1d
```

### PR Creation Fails with 404

- Verify token has **Pull requests: Read and write** permission
- Check repository name is correct in `GIT_REPO_URL`
- Ensure repository is accessible to the token


### Security

- ✅ Runs as non-root user (UID 1000)
- ✅ Read-only root filesystem
- ✅ Minimal container image (Alpine-based)
- ✅ No privileged escalation
- ✅ Token stored in Kubernetes Secret
- ⚠️ Token has write access to repository (by design)

### Best Practices

1. **Start small** - Test on non-production namespace first
2. **Review PRs** - Don't auto-merge initially
3. **Monitor results** - Track cost savings and incidents
4. **Adjust targets** - Start conservative (0.50), increase gradually
5. **Set up alerts** - Know when job fails
6. **Document process** - Share with team

### Resource Requirements

```yaml
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "200m"
```

Typical run time: 30-60 seconds for 100 containers

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🗺️ Roadmap

- [ ] GitLab support
- [ ] Bitbucket support
- [ ] Helm chart values.yaml support
- [ ] Kustomize base/overlay support
- [ ] Slack/Teams notifications

## ⭐ Star History

If this project helps you reduce cloud costs, please consider giving it a star! ⭐

---

**Built with ❤️ for the Kubernetes community**
