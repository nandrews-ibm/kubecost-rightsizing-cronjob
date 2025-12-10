# Multi-stage build for smaller final image
# Supports both amd64 and arm64
FROM --platform=$BUILDPLATFORM alpine:3.19 AS builder

# Pass architecture arguments
ARG TARGETPLATFORM
ARG BUILDPLATFORM
ARG TARGETARCH

# Install build dependencies
RUN apk add --no-cache \
    wget

# Install yq (use Docker's TARGETARCH variable)
RUN if [ "$TARGETARCH" = "amd64" ]; then YQ_ARCH="amd64"; \
    elif [ "$TARGETARCH" = "arm64" ]; then YQ_ARCH="arm64"; \
    else echo "Unsupported architecture: $TARGETARCH" && exit 1; fi && \
    wget https://github.com/mikefarah/yq/releases/download/v4.40.5/yq_linux_${YQ_ARCH} -O /usr/bin/yq && \
    chmod +x /usr/bin/yq

# Final stage
FROM alpine:3.19

# Architecture arguments
ARG TARGETARCH

LABEL maintainer="your-team@example.com"
LABEL description="Kubecost Resource Rightsizing Bot"
LABEL version="1.0.0"

# Install runtime dependencies
RUN apk add --no-cache \
    bash \
    git \
    curl \
    jq \
    ca-certificates

# Copy yq from builder
COPY --from=builder /usr/bin/yq /usr/bin/yq

# Create non-root user
RUN addgroup -g 1000 kubecost && \
    adduser -D -u 1000 -G kubecost kubecost

# Create app directory
RUN mkdir -p /app && chown kubecost:kubecost /app

# Copy the wrapper script that validates ConfigMap is mounted
COPY --chown=kubecost:kubecost scripts/wrapper.sh /app/wrapper.sh
RUN chmod +x /app/wrapper.sh

# Switch to non-root user
USER kubecost

WORKDIR /app

# Use wrapper as entrypoint (validates ConfigMap is present)
ENTRYPOINT ["/app/wrapper.sh"]

# Health check (optional, useful for testing)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bash --version && git --version && curl --version && jq --version && yq --version || exit 1
