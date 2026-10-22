#!/bin/bash
# Assemble l'image et la voix, avec normalisation du volume (loudnorm, -16 LUFS : bon niveau pour les réseaux).
# usage : mux.sh <video_sans_son.mp4> <voix.wav> <sortie.mp4>
set -e
ffmpeg -y -loglevel error -i "$1" -i "$2" \
  -filter_complex "[1:a]loudnorm=I=-16:TP=-1.5:LRA=9,aresample=48000,pan=stereo|c0=c0|c1=c0[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -movflags +faststart -shortest "$3"
echo "ok $3"
