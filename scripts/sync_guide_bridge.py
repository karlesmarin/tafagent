"""Check or copy the shared bridge modules to a local Quarto guide source tree.

Usage: python scripts/sync_guide_bridge.py PATH_TO_MANUAL [--write]
Run Quarto separately after copying. No publication or network operations.
"""
from pathlib import Path
import argparse
import shutil

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('guide_source',type=Path)
parser.add_argument('--write',action='store_true',help='Copy shared guide and research modules; default only checks')
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
guide=args.guide_source.resolve()
for lang in ('en','es'):
    if not (guide/lang/'_quarto.yml').is_file():
        parser.error(f'Not a bilingual guide source tree: {guide}')
different=[]
for lang in ('en','es'):
    for name in ('guide_bridge.js','guide_chapters.js','research_labs.js','research_lab_math.js','research_lab_i18n.js'):
        source=root/'js'/name
        target=guide/lang/'assets'/name
        if not target.is_file() or source.read_bytes()!=target.read_bytes():
            different.append(str(target))
            if args.write:
                target.parent.mkdir(parents=True,exist_ok=True)
                shutil.copy2(source,target)
    source=root/'css/research_labs.css'
    target=guide/lang/'assets/research_labs.css'
    if not target.is_file() or source.read_bytes()!=target.read_bytes():
        different.append(str(target))
        if args.write:
            target.parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(source,target)
if different:
    print(('Copied' if args.write else 'Out of sync')+':\n'+'\n'.join(different))
else:
    print('Shared guide modules match TAF byte for byte (EN/ES).')
raise SystemExit(bool(different) and not args.write)
