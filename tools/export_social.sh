#!/bin/bash
# Version pour l'envoi sur les réseaux : sans métadonnées, et sous une taille cible (en Mo).
# Si la vidéo est déjà assez légère, simple copie ; sinon encodage en deux passes pour garder le maximum de qualité.
# usage : export_social.sh <entree.mp4> <sortie.mp4> [taille_max_Mo=9.3]
set -e
IN="$1"; OUT="$2"; MAX="${3:-9.3}"
SIZE=$(stat -c %s "$IN" 2>/dev/null || stat -f %z "$IN")
if python3 -c "import sys; sys.exit(0 if $SIZE <= $MAX*1024*1024 else 1)"; then
  ffmpeg -y -loglevel error -i "$IN" -map 0 -c copy -map_metadata -1 -movflags +faststart "$OUT"
else
  DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")
  ABR=96
  VBR=$(python3 -c "print(int(($MAX*8*1000*1000/$DUR/1000) - $ABR - 12))")
  TMP=$(mktemp -d)
  ffmpeg -y -loglevel error -i "$IN" -c:v libx264 -preset slow -b:v ${VBR}k -pass 1 -passlogfile "$TMP/p" -an -f mp4 /dev/null
  ffmpeg -y -loglevel error -i "$IN" -c:v libx264 -preset slow -b:v ${VBR}k -pass 2 -passlogfile "$TMP/p" -pix_fmt yuv420p \
    -c:a aac -b:a ${ABR}k -map_metadata -1 -movflags +faststart "$OUT"
  rm -rf "$TMP"
fi
ls -l "$OUT" | awk '{printf "%.2f Mo\n",$5/1048576}'
