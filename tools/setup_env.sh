#!/bin/bash
# Installe tout ce qu'il faut : dépendances Python, Chromium (Playwright), polices, modèle de voix et Whisper.
# usage : bash tools/setup_env.sh [voix=siwis]        (voix disponibles : voir VOICES dans tools/voice.py)
set -e
cd "$(dirname "$0")/.."
VOICE="${1:-siwis}"

echo "== Python"
pip install -q -r requirements.txt 2>/dev/null || pip install --break-system-packages -q -r requirements.txt
if [ -z "$CHROMIUM_PATH" ]; then python3 -m playwright install chromium; fi
command -v ffmpeg >/dev/null || { echo "FFmpeg manquant : installe-le (brew install ffmpeg / apt install ffmpeg)"; exit 1; }

echo "== Polices (SIL Open Font License, via le paquet npm @fontsource)"
mkdir -p fonts
for pkg in montserrat inter jetbrains-mono; do
  if ! ls fonts/${pkg}-latin-* >/dev/null 2>&1; then
    tmp=$(mktemp -d)
    (cd "$tmp" && npm pack -s "@fontsource/${pkg}@5.2.8" >/dev/null && tar xzf ./*.tgz)
    cp "$tmp"/package/files/${pkg}-latin-{500,700,800,900}-normal.woff2 fonts/ 2>/dev/null || true
    cp "$tmp"/package/LICENSE fonts/LICENSE-${pkg}.txt 2>/dev/null || true
    rm -rf "$tmp"
  fi
done

echo "== Modèles (voix « $VOICE » + Whisper base pour le contrôle)"
MODEL=$(python3 -c "import sys; sys.path.insert(0,'tools'); from voice import VOICES; print(VOICES['$VOICE'][0])")
mkdir -p models && cd models
if [ ! -d "$MODEL" ]; then
  curl -sL -o v.tar.bz2 "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/$MODEL.tar.bz2"
  tar xjf v.tar.bz2 && rm v.tar.bz2
fi
if [ ! -d sherpa-onnx-whisper-base ]; then
  curl -sL -o wb.tar.bz2 https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-base.tar.bz2
  tar xjf wb.tar.bz2 && rm wb.tar.bz2
fi
echo "ok : environnement prêt"
