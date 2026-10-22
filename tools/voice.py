"""Voix off + timeline :  python3 tools/voice.py <dossier_video> [voix] [vitesse]
Lit <dossier_video>/story.json, écrit build/voice.wav et build/timeline.json.

story.json : {"phrases": [ <phrase>, ... ]}
  phrase = liste de chunks (ou {"chunks": [...]})
  chunk  = "texte affiché avec *mot clé*"               -> dit tel quel (nombres en lettres, règles de pron.json)
         | {"show": "texte affiché", "say": "texte dit"} -> prononciation forcée pour ce passage
Chaque chunk devient une légende à l'écran ; les phrases donnent le rythme (une pause après chacune).

La timeline contient, pour chaque phrase et chaque chunk, ses instants de début/fin,
plus « env » : le volume de la voix image par image (sert à ouvrir la bouche du personnage)."""
import sys, os, re, json, glob
import numpy as np, soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import ROOT, MODELS, FPS

# voix Piper (VITS) distribuées par sherpa-onnx : nom court -> (dossier du modèle, numéro de locuteur)
# Ajoute la tienne : https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models
VOICES = {
    'siwis': ('vits-piper-fr_FR-siwis-medium', 0),   # française, voix féminine
    'upmc': ('vits-piper-fr_FR-upmc-medium', 1),     # française, voix masculine
    'gilles': ('vits-piper-fr_FR-gilles-low', 0),    # française, voix masculine (modèle léger)
    'amy': ('vits-piper-en_US-amy-medium', 0),       # anglaise (US)
}
DEFAULT_VOICE = os.environ.get('STUDIO_VOICE', 'siwis')


def plain(s):
    return s.replace('*', '').replace('~', '')


# ---------- normalisation du texte dit ----------
def _n2w(n, **kw):
    from num2words import num2words
    return num2words(n, lang='fr', **kw)


def numbers_to_words(s):
    s = re.sub(r'(\d)[   ](\d{3})(?!\d)', r'\1\2', s)   # 4 000 -> 4000
    s = re.sub(r'(\d)[   ](\d{3})(?!\d)', r'\1\2', s)
    s = re.sub(r'\b1er\b', 'premier', s); s = re.sub(r'\b1re\b', 'première', s)
    s = re.sub(r'\b(\d+)(?:e|ème|eme)\b', lambda m: _n2w(int(m.group(1)), to='ordinal'), s)
    s = re.sub(r'(\d+),(\d+)', lambda m: _n2w(int(m.group(1))) + ' virgule ' + ' '.join(_n2w(int(c)) for c in m.group(2)), s)
    s = s.replace('%', ' pour cent').replace('°C', ' degrés').replace('€', ' euros').replace('$', ' dollars').replace('≈', ' environ ')
    s = re.sub(r'(\d)\s*km\b', r'\1 kilomètres', s)
    s = re.sub(r'(\d)\s*nm\b', r'\1 nanomètres', s)
    s = re.sub(r'\d+', lambda m: _n2w(int(m.group(0))), s)
    return re.sub(r'\s+', ' ', s)


def load_rules():
    p = os.path.join(ROOT, 'pron.json')
    return json.load(open(p, encoding='utf-8'))['rules'] if os.path.exists(p) else []


def normalize_say(text, rules=None):
    rules = load_rules() if rules is None else rules
    s = plain(text)
    for pat, rep in rules:
        s = re.sub(pat, rep, s)
    s = numbers_to_words(s)
    return s.replace('—', ',').replace('–', ',').replace('…', '...').strip()


def parse_story(path):
    st = json.load(open(path, encoding='utf-8')); out = []
    for i, p in enumerate(st['phrases']):
        chunks = p['chunks'] if isinstance(p, dict) else p
        cs = []
        for c in chunks:
            if isinstance(c, str):
                cs.append({'show': c, 'say': normalize_say(c)})
            else:
                cs.append({'show': c['show'], 'say': c['say'] if 'say' in c else normalize_say(c['show'])})
        out.append({'id': i, 'chunks': cs})
    return st, out


def synth(vdir, voice=DEFAULT_VOICE, speed=1.05):
    import sherpa_onnx
    name, sid = VOICES[voice]; d = os.path.join(MODELS, name)
    onnx = [m for m in glob.glob(f'{d}/*.onnx')]
    if not onnx:
        sys.exit(f'modèle de voix introuvable dans {d} : lance  bash tools/setup_env.sh {voice}')
    cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
        vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=onnx[0], tokens=f'{d}/tokens.txt', data_dir=f'{d}/espeak-ng-data'),
        num_threads=2, provider='cpu'))
    tts = sherpa_onnx.OfflineTts(cfg); sr = tts.sample_rate
    st, phrases = parse_story(os.path.join(vdir, 'story.json'))
    out = os.path.join(vdir, 'build'); os.makedirs(out, exist_ok=True)
    lead = 0.3; t = lead; parts = [np.zeros(int(lead * sr), dtype='float32')]; tl = []

    def trim(x):   # retire les silences de début/fin de chaque phrase
        idx = np.where(np.abs(x) > 0.012)[0]
        if len(idx) == 0:
            return x
        return x[max(0, idx[0] - int(0.03 * sr)): min(len(x), idx[-1] + int(0.05 * sr))]

    for p in phrases:
        text = ' '.join(c['say'] for c in p['chunks'])
        a = tts.generate(text, sid=sid, speed=speed)
        x = trim(np.array(a.samples, dtype='float32')); dur = len(x) / sr
        # répartition des chunks au prorata du nombre de caractères prononcés (simple et suffisant pour des légendes)
        lens = [max(1, len(c['say'])) for c in p['chunks']]; tot = sum(lens); acc = 0; ch = []
        for c, l in zip(p['chunks'], lens):
            s0 = t + dur * acc / tot; acc += l; e0 = t + dur * acc / tot
            ch.append({'start': round(s0, 3), 'end': round(e0, 3), 'say': c['say'], 'show': c['show']})
        pause = 0.30 if text.strip()[-1:] in '.?!' else 0.18
        tl.append({'id': p['id'], 'start': round(t, 3), 'end': round(t + dur, 3), 'text': text, 'chunks': ch})
        parts += [x, np.zeros(int(pause * sr), dtype='float32')]; t += dur + pause
    parts.append(np.zeros(int(1.4 * sr), dtype='float32'))
    y = np.concatenate(parts); total = len(y) / sr
    sf.write(os.path.join(out, 'voice.wav'), y, sr)
    # enveloppe de volume (RMS) image par image, normalisée 0..1
    n = int(total * FPS) + 1; hop = sr / FPS; env = []
    for i in range(n):
        seg = y[int(i * hop): int((i + 1) * hop) + int(0.01 * sr)]
        env.append(float(np.sqrt(np.mean(seg ** 2))) if len(seg) else 0.0)
    m = max(env) or 1; env = [round(v / m, 3) for v in env]
    json.dump({'voice': voice, 'speed': speed, 'sr': sr, 'total': round(total, 3), 'phrases': tl, 'env': env, 'fps': FPS},
              open(os.path.join(out, 'timeline.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'voix {voice} : {round(total, 1)} s, {len(tl)} phrases')
    return total


if __name__ == '__main__':
    synth(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else DEFAULT_VOICE, float(sys.argv[3]) if len(sys.argv) > 3 else 1.05)
