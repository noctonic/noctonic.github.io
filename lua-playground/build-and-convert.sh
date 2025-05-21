#!/bin/bash
set -euo pipefail

# Name for your Docker image
IMAGE_NAME=lua-wasi-demo

# Output directory for GitHub Pages (containers folder)
OUT_DIR=./docs/containers
# WASM output (intermediate full file)
WASM_FILE=${OUT_DIR}/lua-wasi.wasm
# Chunk size (BSD split compatible)
CHUNK_SIZE=50MB

# Ensure output dir exists
mkdir -p "${OUT_DIR}"

# 1) Build the Docker image for linux/amd64
echo "▶ Building Docker image ${IMAGE_NAME}"
docker buildx build \
  --platform=linux/amd64 \
  -t "${IMAGE_NAME}" \
  -f Dockerfile \
  .

echo
# 2) Convert the image to a full WASM file
echo "▶ Converting ${IMAGE_NAME} → ${WASM_FILE}"
c2w --target-arch=amd64 "${IMAGE_NAME}" "${WASM_FILE}"

echo
# Split into numeric files
split -d -b "${CHUNK_SIZE}" -a 2 \
      "${WASM_FILE}" \
      "${OUT_DIR}/lua-wasi"

# Rename *only* the chunks (00,01,02), not the original .wasm
for piece in "${OUT_DIR}/lua-wasi"[0-9][0-9]; do
  mv "$piece" "$piece.wasm"
done

# Now it's safe to remove the original
rm "${WASM_FILE}"

