"""Fabrique une vidéo.   python3 tools/make_video.py <dossier_video> <étape> [options]

étapes (dans l'ordre) :
  new      crée le dossier à partir de videos/_modele
  voice    story.json -> build/voice.wav + build/timeline.json          (--voice siwis --speed 1.05)
  qa       réécoute la voix (Whisper) et signale les phrases mal prononcées
  page     assemble build/index.html (+ timeline.js, spec.js)
  assets   rend les PNG du personnage manquants (cache partagé assets/character/)
  preview  planches build/preview*.jpg + détection des débordements      [--times 3.2 10 ...]
  render   rendu complet + voix -> out/video.mp4, out/video_social.mp4 (< 9,3 Mo), out/cover.jpg
  cover    seulement l'image de couverture                                [--times 2.5]
  prep     = voice + qa + page + assets + preview       all = prep + render
"""
import sys, os, json, subprocess, shutil, glob, asyncio, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import HERE, ROOT, ASSETS, chromium_options, W, H

ap = argparse.ArgumentParser()
ap.add_argument('vdir'); ap.add_argument('step')
ap.add_argument('--voice', default=os.environ.get('STUDIO_VOICE', 'siwis')); ap.add_argument('--speed', type=float, default=1.05)
ap.add_argument('--times', nargs='*', type=float); ap.add_argument('--workers', type=int, default=2)
ap.add_argument('--max-mb', type=float, default=9.3)
A = ap.parse_args()
VDIR = os.path.abspath(A.vdir); BUILD = os.path.join(VDIR, 'build'); OUT = os.path.join(VDIR, 'out')
PAGE = os.path.join(BUILD, 'index.html')


def sh(cmd, **kw):
    return subprocess.run(cmd, shell=isinstance(cmd, str), check=True, **kw)


def step_new():
    if os.path.exists(VDIR):
        sys.exit(f'{VDIR} existe déjà')
    shutil.copytree(os.path.join(ROOT, 'videos', '_modele'), VDIR)
    print('créé :', VDIR, '-> écris story.json puis scenes.json')


def step_voice():
    import voice
    voice.synth(VDIR, A.voice, A.speed)


def step_qa():
    sh([sys.executable, os.path.join(HERE, 'qa_asr.py'), VDIR])


def step_page():
    tl = open(os.path.join(BUILD, 'timeline.json'), encoding='utf-8').read()
    open(os.path.join(BUILD, 'timeline.js'), 'w', encoding='utf-8').write('window.TL=' + tl + ';')
    rel = os.path.relpath(ROOT, BUILD).replace(os.sep, '/') + '/'
    html = open(os.path.join(ROOT, 'engine', 'template.html'), encoding='utf-8').read().replace('{{ROOT}}', rel)
    theme = '<script src="../theme.js"></script>' if os.path.exists(os.path.join(VDIR, 'theme.js')) else ''
    if os.path.exists(os.path.join(VDIR, 'scenes.js')):          # scènes écrites à la main en JS (liberté totale)
        scripts = '<script src="../scenes.js"></script>'
    else:                                                         # scènes décrites en JSON (cas normal)
        spec = json.load(open(os.path.join(VDIR, 'scenes.json'), encoding='utf-8'))
        open(os.path.join(BUILD, 'spec.js'), 'w', encoding='utf-8').write('window.SPEC=' + json.dumps(spec, ensure_ascii=False) + ';')
        extra = '<script src="../extra.js"></script>\n' if os.path.exists(os.path.join(VDIR, 'extra.js')) else ''
        scripts = (f'<script src="{rel}engine/kit.js"></script>\n<script src="{rel}engine/shapes.js"></script>\n' + extra +
                   '<script src="spec.js"></script>\n<script>K.build(window.SPEC);</script>')
    open(PAGE, 'w', encoding='utf-8').write(html.replace('{{THEME}}', theme).replace('{{SCRIPTS}}', scripts))
    print('page ok')


async def _browser():
    from playwright.async_api import async_playwright
    p = await async_playwright().start()
    b = await p.chromium.launch(**chromium_options())
    pg = await b.new_page(viewport={'width': W, 'height': H}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    await pg.goto('file://' + PAGE); await pg.wait_for_timeout(600)
    return p, b, pg, errs


def render_character_pngs(keys, cache=ASSETS):
    """Rend chaque combinaison mode__pose__expr__bouche__props en PNG transparent (une seule fois, puis cache)."""
    os.makedirs(cache, exist_ok=True)
    missing = [k for k in keys if not os.path.exists(os.path.join(cache, k + '.png'))]
    if not missing:
        return 0

    async def go():
        from playwright.async_api import async_playwright
        async with async_playwright() as pw:
            br = await pw.chromium.launch(**chromium_options())
            pg = await br.new_page(viewport={'width': 900, 'height': 1200}, device_scale_factor=1.5)
            await pg.goto('file://' + os.path.join(HERE, 'asset_page.html')); await pg.wait_for_timeout(300)
            for k in missing:
                mode, pose, expr, op, props = k.split('__')
                o = {'headOnly': mode == 'head', 'pose': pose, 'expr': expr, 'open': op == 'o', 'props': [] if props == '-' else props.split('+')}
                w, h = await pg.evaluate('o=>window.draw(o)', o)
                await pg.screenshot(path=os.path.join(cache, k + '.png'), clip={'x': 0, 'y': 0, 'width': w, 'height': h}, omit_background=True)
            await br.close()
    asyncio.run(go())
    return len(missing)


def step_assets():
    async def keys():
        p, b, pg, errs = await _browser()
        k = await pg.evaluate('Array.from(window.NEEDED||[])'); await b.close(); await p.stop()
        if errs:
            print('ERREURS PAGE :', errs[:5])
        return k
    k = asyncio.run(keys())
    print(len(k), 'images du personnage utilisées,', render_character_pngs(k), 'générées')


# repère les éléments qui sortent de l'écran ou dont le texte déborde de son cadre
LINT_JS = """() => { const out = []; document.querySelectorAll('#stage *').forEach(e => {
  if (e.closest('[data-lint=off]') || e.classList.contains('scene') || e.classList.contains('bgl') || e.classList.contains('hz') || e.classList.contains('charwrap') || e.tagName==='IMG' || e.tagName==='path' || e.tagName==='svg') return;
  const r = e.getBoundingClientRect(); if (r.width === 0 || r.height === 0 || e.offsetParent === null) return;
  if (r.right > 1083 || r.left < -3 || r.bottom > 1923) out.push((e.className || e.tagName) + ' « ' + (e.textContent || '').slice(0, 30) + ' » x=' + Math.round(r.left) + '..' + Math.round(r.right) + ' y=' + Math.round(r.top) + '..' + Math.round(r.bottom));
  const st = getComputedStyle(e); if (e.scrollWidth > e.clientWidth + 4 && st.overflow === 'visible' && e.children.length === 0 && e.clientWidth > 0 && st.display !== 'inline') out.push('texte plus large que son cadre : ' + (e.textContent || '').slice(0, 30));
}); return out; }"""


def scene_times():
    """Deux instants par scène (juste après l'entrée, juste avant la sortie) pour les planches de contrôle."""
    tl = json.load(open(os.path.join(BUILD, 'timeline.json'), encoding='utf-8')); P = tl['phrases']; total = tl['total']
    sp = os.path.join(BUILD, 'spec.js'); ts = []
    if os.path.exists(sp) and not os.path.exists(os.path.join(VDIR, 'scenes.js')):
        spec = json.loads(open(sp, encoding='utf-8').read()[len('window.SPEC='):-1])
        for sd in spec['scenes']:
            a, b = sd['from'], sd['to']
            s0 = 0 if a == 0 else (P[a - 1]['end'] + P[a]['start']) / 2
            e0 = total if b >= len(P) - 1 else (P[b]['end'] + P[b + 1]['start']) / 2
            ts += [round(s0 + 0.9, 2), round(max(s0 + 1.0, e0 - 0.5), 2)]
    else:
        ts = [round(t, 1) for t in range(1, int(total), 6)]
    return sorted(set(ts))


def step_preview():
    from PIL import Image, ImageDraw
    times = A.times or scene_times(); pdir = os.path.join(BUILD, 'preview')
    shutil.rmtree(pdir, ignore_errors=True); os.makedirs(pdir)

    async def go():
        p, b, pg, errs = await _browser(); await pg.wait_for_function('window.READY===true', timeout=90000)
        problems = []
        for t in times:
            await pg.evaluate('t=>window.renderAt(t)', t); await pg.screenshot(path=os.path.join(pdir, f't_{t:07.2f}.png'))
            for m in await pg.evaluate(LINT_JS):
                problems.append(f't={t}: {m}')
        await b.close(); await p.stop()
        print('erreurs page :', errs[:5]); print('\n'.join(problems[:30]) if problems else 'aucun débordement détecté')
    asyncio.run(go())
    files = sorted(glob.glob(pdir + '/t_*.png')); tw, th, cols = 270, 480, 8
    for part in range(0, len(files), 16):
        fs = files[part:part + 16]; rows = (len(fs) + cols - 1) // cols
        S = Image.new('RGB', (cols * tw, rows * (th + 20)), (30, 30, 30)); d = ImageDraw.Draw(S)
        for i, f in enumerate(fs):
            S.paste(Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS), ((i % cols) * tw, (i // cols) * (th + 20) + 20))
            d.text(((i % cols) * tw + 6, (i // cols) * (th + 20) + 4), os.path.basename(f)[2:-4] + ' s', fill=(255, 255, 255))
        S.save(os.path.join(BUILD, f'preview{"" if part == 0 else part // 16 + 1}.jpg'), quality=88)
    print('planche(s) :', ', '.join(os.path.basename(x) for x in sorted(glob.glob(BUILD + '/preview*.jpg'))))


def step_render():
    os.makedirs(OUT, exist_ok=True)
    tl = json.load(open(os.path.join(BUILD, 'timeline.json'), encoding='utf-8')); n = len(tl['env'])
    nw = max(1, A.workers); cuts = [round(n * i / nw) for i in range(nw + 1)]; parts = []; procs = []
    for i in range(nw):
        o = os.path.join(BUILD, f'part{i}.mp4'); parts.append(o)
        procs.append(subprocess.Popen([sys.executable, os.path.join(HERE, 'render_frames.py'), PAGE, str(cuts[i]), str(cuts[i + 1]), o]))
    for p in procs:
        p.wait()
    with open(os.path.join(BUILD, 'list.txt'), 'w') as f:
        f.write(''.join(f"file '{p}'\n" for p in parts))
    sh(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', os.path.join(BUILD, 'list.txt'), '-c', 'copy', os.path.join(BUILD, 'video_only.mp4')])
    sh(['bash', os.path.join(HERE, 'mux.sh'), os.path.join(BUILD, 'video_only.mp4'), os.path.join(BUILD, 'voice.wav'), os.path.join(OUT, 'video.mp4')])
    sh(['bash', os.path.join(HERE, 'export_social.sh'), os.path.join(OUT, 'video.mp4'), os.path.join(OUT, 'video_social.mp4'), str(A.max_mb)])
    step_cover()


def step_cover():
    os.makedirs(OUT, exist_ok=True)
    tl = json.load(open(os.path.join(BUILD, 'timeline.json'), encoding='utf-8')); P = tl['phrases']
    t = A.times[0] if A.times else max(1.0, P[min(1, len(P) - 1)]['end'] - 0.1)

    async def go():
        p, b, pg, errs = await _browser(); await pg.wait_for_function('window.READY===true', timeout=90000)
        await pg.evaluate('t=>window.renderAt(t)', t)
        await pg.screenshot(path=os.path.join(OUT, 'cover.jpg'), type='jpeg', quality=92); await b.close(); await p.stop()
    asyncio.run(go()); print('cover.jpg à t =', round(t, 2), 's')


STEPS = {'new': step_new, 'voice': step_voice, 'qa': step_qa, 'page': step_page, 'assets': step_assets,
         'preview': step_preview, 'render': step_render, 'cover': step_cover}
seq = {'prep': ['voice', 'qa', 'page', 'assets', 'preview'],
       'all': ['voice', 'qa', 'page', 'assets', 'preview', 'render']}.get(A.step, [A.step])
if A.step != 'new':
    os.makedirs(BUILD, exist_ok=True)
for s in seq:
    print('==', s); STEPS[s]()
