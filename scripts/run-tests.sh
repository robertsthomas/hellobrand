#!/usr/bin/env bash

set -euo pipefail

pnpm run test
pnpm run test:e2e
