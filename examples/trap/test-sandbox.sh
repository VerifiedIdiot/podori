#!/bin/sh
set -eu
cd "$(dirname "$0")"
# Use only the prepared image. This command never pulls an image.
exec docker run --rm --pull=never --network none --read-only \
  --cap-drop ALL --security-opt no-new-privileges \
  --cpus 1 --memory 128m --memory-swap 128m --pids-limit 64 \
  --ulimit nofile=128:128 --user 65534:65534 --log-driver none \
  --tmpfs /tmp:rw,noexec,nosuid,size=16m \
  --env HOME=/tmp --env npm_config_cache=/tmp/npm \
  --mount "type=bind,src=$PWD,dst=/app,readonly" --workdir /app \
  node@sha256:9bef0ef1e268f60627da9ba7d7605e8831d5b56ad07487d24d1aa386336d1944 \
  timeout 30 npm --offline --no-audit --no-fund --update-notifier=false test
