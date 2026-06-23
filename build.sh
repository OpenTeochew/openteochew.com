#!/bin/bash
set -e

trap 'echo "❌ $(basename "$0") 失敗：第 $LINENO 行（指令：$BASH_COMMAND）" >&2' ERR

echo "Building OpenTeochew..."

STATIC_DIR="backend/public"
mkdir -p "$STATIC_DIR"
if [ -d "$STATIC_DIR/scans" ]; then
  mv "$STATIC_DIR/scans" /tmp/openteochew-scans-backup
fi
rm -rf "$STATIC_DIR"/*

if [ ! -d "web/node_modules" ]; then
  echo "Installing frontend dependencies..."
  cd web && npm install && cd ..
fi

echo "Building frontend..."
cd web && npm run build && cd ..

echo "Copying build output to backend/public..."
cp -r web/dist/* "$STATIC_DIR"/

if [ -d /tmp/openteochew-scans-backup ]; then
  mv /tmp/openteochew-scans-backup "$STATIC_DIR/scans"
fi

if [ -d "$STATIC_DIR" ] && [ "$(ls -A $STATIC_DIR)" ]; then
  echo "Build complete!"
else
  echo "Error: build output copy failed"
  exit 1
fi
