#!/usr/bin/env bash
set -euo pipefail

echo "Deploying dev app..."
fly deploy --config fly.dev.app.toml --local-only

echo "Deploying dev worker..."
fly deploy --config fly.dev.worker.toml --local-only

echo "Dev deploy complete."
