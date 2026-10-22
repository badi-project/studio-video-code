"""Rendu image par image :  python3 tools/render_frames.py <page.html> <image_début> <image_fin_exclue> <sortie.mp4>
Capture la page en 1080x1920 à chaque instant i/FPS (window.renderAt) et envoie les PNG à FFmpeg par un tube.
make_video.py lance plusieurs de ces processus en parallèle sur des tranches différentes, puis les recolle."""
import sys, os, asyncio, subprocess, time
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import chromium_options, FPS, W, H

page, f0, f1, out = os.path.abspath(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]


async def main():
    ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'png', '-i', '-',
                           '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', str(FPS), out],
                          stdin=subprocess.PIPE)
    async with async_playwright() as p:
        b = await p.chromium.launch(**chromium_options())
        pg = await b.new_page(viewport={'width': W, 'height': H})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + page)
        await pg.wait_for_function('window.READY===true', timeout=120000)
        t0 = time.time()
        for i in range(f0, f1):
            await pg.evaluate('t=>window.renderAt(t)', i / FPS)
            ff.stdin.write(await pg.screenshot(type='png'))
            if (i - f0) % 150 == 0:
                print(f'[{os.path.basename(out)}] {i}/{f1} ({(i - f0 + 1) / (time.time() - t0 + 1e-6):.1f} i/s)', flush=True)
        await b.close()
    ff.stdin.close(); ff.wait()
    print('fini', out, 'erreurs page :', errs[:3], flush=True)

asyncio.run(main())
