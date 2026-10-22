"""Planche du personnage (toutes les poses + expressions) :  python3 tools/character_sheet.py [sortie.png]
À regarder après chaque modification de character/character.js."""
import sys, os, asyncio
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import HERE, ROOT, chromium_options
from playwright.async_api import async_playwright

out = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'build', 'planche_personnage.png'))
os.makedirs(os.path.dirname(out), exist_ok=True)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**chromium_options())
        pg = await b.new_page(viewport={'width': 2100, 'height': 1200})
        await pg.goto('file://' + os.path.join(HERE, 'sheet.html'))
        await pg.wait_for_function('window.READY===true'); await pg.evaluate('document.fonts.ready')
        await pg.screenshot(path=out, full_page=True)
        await b.close()
    print('planche :', out)

asyncio.run(main())
