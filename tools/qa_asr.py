"""Contrôle de prononciation : réécoute la voix avec Whisper et compare phrase par phrase.
usage : python3 tools/qa_asr.py <dossier_video>      (alerte si similarité < 0,85)
Whisper se trompe parfois sur les noms propres rares : une alerte est un signal à écouter, pas une vérité."""
import sys, os, re, json, difflib, unicodedata
import numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import MODELS
from voice import numbers_to_words
import sherpa_onnx

d = os.path.join(MODELS, 'sherpa-onnx-whisper-base')
rec = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=f'{d}/base-encoder.int8.onnx', decoder=f'{d}/base-decoder.int8.onnx',
                                                 tokens=f'{d}/base-tokens.txt', language=os.environ.get('STUDIO_LANG', 'fr'),
                                                 task='transcribe', num_threads=2)


def norm(s):
    s = numbers_to_words(s.lower()); s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z]', '', s)


vdir = sys.argv[1]
tl = json.load(open(os.path.join(vdir, 'build', 'timeline.json'), encoding='utf-8'))
x, sr = sf.read(os.path.join(vdir, 'build', 'voice.wav'), dtype='float32')
rows = []
for p in tl['phrases']:
    seg = x[max(0, int((p['start'] - 0.15) * sr)): int((p['end'] + 0.15) * sr)]
    n = int(len(seg) * 16000 / sr)
    s16 = np.interp(np.linspace(0, len(seg) - 1, n), np.arange(len(seg)), seg).astype('float32')
    st = rec.create_stream(); st.accept_waveform(16000, s16); rec.decode_stream(st)
    heard = st.result.text.strip()
    r = difflib.SequenceMatcher(None, norm(p['text']), norm(heard)).ratio()
    rows.append((p['id'], r, p['text'], heard))
print(f'similarité moyenne {np.mean([r[1] for r in rows]):.3f}  (min {min(r[1] for r in rows):.2f})')
for i, r, t, a in rows:
    if r < 0.85:
        print(f'  ! P{i} {r:.2f} | dit : {t} || entendu : {a}')
json.dump(rows, open(os.path.join(vdir, 'build', 'qa.json'), 'w', encoding='utf-8'), ensure_ascii=False)
