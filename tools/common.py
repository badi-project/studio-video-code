"""Réglages partagés par les outils (navigateur, dossiers)."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MODELS = os.environ.get('STUDIO_MODELS', os.path.join(ROOT, 'models'))
ASSETS = os.path.join(ROOT, 'assets', 'character')
FPS = 30
W, H = 1080, 1920


def chromium_options():
    """Options de lancement Playwright. CHROMIUM_PATH permet d'utiliser un Chromium déjà installé ;
    sinon Playwright prend le sien (`python3 -m playwright install chromium`)."""
    kw = {'args': ['--no-sandbox', '--allow-file-access-from-files']}
    exe = os.environ.get('CHROMIUM_PATH')
    if exe:
        kw['executable_path'] = exe
    return kw
