"""Audit de confidentialité avant publication d'un dépôt.

usage :  python3 tools/privacy_audit.py [dossier=.] [--private fichier_de_termes] [--allow-email adresse ...]

Ce que l'audit cherche :
  BLOQUANT    termes privés (ton nom, tes comptes, ta ville… listés dans un fichier qui, lui, n'est JAMAIS publié),
              secrets (clés d'API, jetons), adresses e-mail, chemins personnels (/Users/<nom>, /home/<nom>, C:\\Users\\<nom>),
              métadonnées GPS ou d'auteur dans les images et vidéos, auteurs de commits non anonymes
  À VÉRIFIER  @pseudos, numéros de téléphone possibles, adresses IP, liste des domaines cités
Code de sortie 1 s'il reste un point bloquant.

Le fichier de termes privés (un terme par ligne, # pour commenter) se garde HORS du dépôt
ou dans .audit-private.txt, ignoré par git (voir .gitignore)."""
import argparse, os, re, subprocess, sys, unicodedata, json

SKIP_DIRS = {'.git', 'build', 'out', 'models', 'node_modules', '__pycache__', 'assets'}
TEXT_EXT = {'.md', '.txt', '.json', '.js', '.py', '.sh', '.html', '.css', '.yml', '.yaml', '.toml', '.cfg', '.ini', ''}
IMG_EXT = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.tif', '.tiff'}
VID_EXT = {'.mp4', '.mov', '.m4v', '.webm', '.mkv', '.mp3', '.wav', '.m4a'}

SECRET_RE = re.compile(r'(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|gh[ousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,}|'
                       r'AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)')
EMAIL_RE = re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
HOME_RE = re.compile(r'(/Users/(?!<)[^/\s"\'`<>]+|/home/(?!<)[^/\s"\'`<>]+|[A-Za-z]:\\\\?Users\\\\?(?!<)[^\\\s"\'<>]+)')
HANDLE_RE = re.compile(r'(?<![\w.@/+])@[A-Za-z_][A-Za-z0-9_.]{2,30}\b')
PHONE_RE = re.compile(r'(?<!\d)(?:\+\d{2,3}[ .]?\d(?:[ .]?\d{2}){4}|0[1-9](?:[ .]?\d{2}){4})(?!\d)')
IP_RE = re.compile(r'(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])')
URL_RE = re.compile(r'https?://([A-Za-z0-9.-]+)')
SAFE_HANDLES = {'@fontsource', '@media', '@font', '@keyframes', '@import', '@supports', '@playwright', '@users.noreply.github.com'}


def fold(s):
    """minuscules sans accents, pour comparer « Élodie » et « elodie »."""
    return ''.join(c for c in unicodedata.normalize('NFKD', s.lower()) if unicodedata.category(c) != 'Mn')


def term_re(t):
    """motif d'un terme privé : insensible à la casse et aux accents, en mot entier quand il commence/finit par une lettre ou un chiffre
    (« Rome » ne doit pas correspondre à « chromé »)."""
    ft = fold(t)
    a = r'(?<![a-z0-9])' if ft[:1].isalnum() else ''
    b = r'(?![a-z0-9])' if ft[-1:].isalnum() else ''
    return re.compile(a + re.escape(ft) + b)


def list_files(root):
    try:   # dans un dépôt git : exactement ce qui sera publié (fichiers suivis + nouveaux non ignorés)
        out = subprocess.run(['git', '-C', root, 'ls-files', '-co', '--exclude-standard'], capture_output=True, text=True, check=True).stdout
        files = [f for f in out.splitlines() if f]
        if files:
            return sorted(set(files))
    except Exception:
        pass
    files = []
    for d, dirs, fs in os.walk(root):
        dirs[:] = [x for x in dirs if x not in SKIP_DIRS]
        files += [os.path.relpath(os.path.join(d, f), root) for f in fs]
    return sorted(files)


def media_metadata(path):
    """Renvoie les métadonnées suspectes d'une image ou d'une vidéo."""
    found = []
    ext = os.path.splitext(path)[1].lower()
    if ext in IMG_EXT:
        try:
            from PIL import Image
            im = Image.open(path)
            exif = im.getexif()
            if exif:
                found.append(f'EXIF présent ({len(exif)} champs)')
                if 0x8825 in exif:
                    found.append('coordonnées GPS')
            for k, v in (im.info or {}).items():
                if k in ('exif', 'icc_profile', 'dpi', 'gamma', 'transparency', 'duration', 'loop', 'background', 'version', 'aspect', 'srgb', 'progressive', 'progression', 'jfif', 'jfif_version', 'jfif_unit', 'jfif_density', 'adobe', 'adobe_transform', 'interlace', 'extension'):
                    continue
                found.append(f'champ {k} = {str(v)[:60]}')
        except Exception as e:
            found.append(f'illisible : {e}')
    elif ext in VID_EXT:
        try:
            out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format_tags:stream_tags', '-of', 'json', path], capture_output=True, text=True).stdout
            tags = {}
            for blk in [json.loads(out).get('format', {})] + json.loads(out).get('streams', []):
                tags.update(blk.get('tags', {}))
            for k, v in tags.items():
                if k.lower() in ('major_brand', 'minor_version', 'compatible_brands', 'encoder', 'handler_name', 'vendor_id', 'language'):
                    continue
                found.append(f'tag {k} = {str(v)[:60]}')
        except Exception as e:
            found.append(f'ffprobe impossible : {e}')
    return found


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('root', nargs='?', default='.')
    ap.add_argument('--private', help='fichier de termes privés (un par ligne)')
    ap.add_argument('--allow-email', nargs='*', default=['noreply@anthropic.com', 'noreply@github.com'], help='adresses autorisées (ex. adresse noreply de GitHub)')
    A = ap.parse_args()
    root = os.path.abspath(A.root)
    terms = []
    pf = A.private or (os.path.join(root, '.audit-private.txt') if os.path.exists(os.path.join(root, '.audit-private.txt')) else None)
    if pf:
        terms = [t.strip() for t in open(pf, encoding='utf-8') if t.strip() and not t.strip().startswith('#')]
    allow = {e.lower() for e in A.allow_email}
    block, review, domains = [], [], {}

    files = list_files(root)
    for rel in files:
        path = os.path.join(root, rel)
        if not os.path.isfile(path):
            continue
        if pf and os.path.abspath(path) == os.path.abspath(pf):
            continue
        # 1. le chemin lui-même
        for t in terms:
            if term_re(t).search(fold(rel)):
                block.append(f'{rel} : terme privé dans le NOM du fichier ({t})')
        raw = open(path, 'rb').read()
        ext = os.path.splitext(rel)[1].lower()
        # 2. termes privés, y compris dans les fichiers binaires
        binary = ext not in TEXT_EXT
        low = fold(raw.decode('utf-8', 'ignore'))
        low16 = fold(raw.decode('utf-16-le', 'ignore')) if binary else ''
        for t in terms:
            if binary and len(t) < 4:          # dans des octets compressés, un terme très court apparaît par hasard
                continue
            rx = term_re(t)
            n = len(rx.findall(low)) + (len(rx.findall(low16)) if low16 else 0)
            if n:
                block.append(f'{rel} : terme privé « {t} » ({n} fois)')
        # 3. motifs génériques dans les fichiers texte
        if ext in TEXT_EXT:
            text = raw.decode('utf-8', 'replace')
            for i, line in enumerate(text.splitlines(), 1):
                for m in SECRET_RE.finditer(line):
                    block.append(f'{rel}:{i} : secret possible {m.group(0)[:12]}…')
                for m in EMAIL_RE.finditer(line):
                    if m.group(0).lower() not in allow and not m.group(0).lower().endswith('@users.noreply.github.com'):
                        block.append(f'{rel}:{i} : adresse e-mail {m.group(0)}')
                for m in HOME_RE.finditer(line):
                    if '(?' in m.group(0):          # le motif de ce script lui-même
                        continue
                    block.append(f'{rel}:{i} : chemin personnel {m.group(0)}')
                for m in HANDLE_RE.finditer(line):
                    if m.group(0).lower() not in SAFE_HANDLES and not EMAIL_RE.search(line[max(0, m.start() - 40):m.end()]):
                        review.append(f'{rel}:{i} : pseudo {m.group(0)}')
                for m in PHONE_RE.finditer(line):
                    review.append(f'{rel}:{i} : numéro possible {m.group(0)}')
                for m in IP_RE.finditer(line):
                    if not m.group(0).startswith(('0.', '127.')):
                        review.append(f'{rel}:{i} : adresse IP possible {m.group(0)}')
                for m in URL_RE.finditer(line):
                    domains.setdefault(m.group(1).lower(), set()).add(rel)
        # 4. métadonnées des médias
        if ext in IMG_EXT | VID_EXT:
            for f in media_metadata(path):
                (block if ('GPS' in f or 'EXIF' in f or 'tag' in f) else review).append(f'{rel} : métadonnée {f}')

    # 5. auteurs des commits
    try:
        log = subprocess.run(['git', '-C', root, 'log', '--all', '--format=%an <%ae>%n%cn <%ce>'], capture_output=True, text=True).stdout
        for who in sorted(set(l for l in log.splitlines() if l)):
            mail = who[who.find('<') + 1:-1].lower()
            ok = mail in allow or mail.endswith('@users.noreply.github.com') or mail == 'noreply@github.com'
            (review if ok else block).append(f'commit : auteur {who}' + ('' if ok else ' (adresse non anonyme)'))
            for t in terms:
                if term_re(t).search(fold(who)):
                    block.append(f'commit : terme privé « {t} » dans l\'auteur')
        msgs = subprocess.run(['git', '-C', root, 'log', '--all', '--format=%B'], capture_output=True, text=True).stdout
        for t in terms:
            if term_re(t).search(fold(msgs)):
                block.append(f'commit : terme privé « {t} » dans un message de commit')
    except Exception:
        pass

    print(f'Audit de {len(files)} fichiers, {len(terms)} termes privés contrôlés\n')
    print(f'BLOQUANT ({len(block)})'); [print('  ✗', b) for b in block] or print('  aucun')
    print(f'\nÀ VÉRIFIER ({len(review)})'); [print('  ?', r) for r in sorted(set(review))] or print('  rien')
    print(f'\nDOMAINES CITÉS ({len(domains)})')
    for d in sorted(domains):
        print(f'  · {d}  ({len(domains[d])} fichier{"s" if len(domains[d]) > 1 else ""})')
    sys.exit(1 if block else 0)


if __name__ == '__main__':
    main()
