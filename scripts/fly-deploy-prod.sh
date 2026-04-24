#!/usr/bin/env bash
set -euo pipefail

echo "Deploying production app..."
fly deploy --config fly.production.app.toml --remote-only

echo "Deploying production worker..."
fly deploy --config fly.production.worker.toml --local-only

echo "Production deploy complete."
