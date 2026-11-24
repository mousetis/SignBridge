#!/usr/bin/env bash
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
[ -f public/mediapipe/hands/hands.js ] || npm run setup:assets
npm run dev
