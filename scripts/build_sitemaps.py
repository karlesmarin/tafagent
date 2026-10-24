"""Build public-page sitemaps deterministically, using only the standard library."""
import argparse
from pathlib import Path
from urllib.parse import quote
import xml.etree.ElementTree as ET

NS = 'http://www.sitemaps.org/schemas/sitemap/0.9'
XHTML = 'http://www.w3.org/1999/xhtml'
TAF = 'https://karlesmarin.github.io/tafagent/'
HF = 'https://karlexmarin-taf-agent.static.hf.space/'
GUIDE = 'https://karlesmarin.github.io/transformers-guide/'
ET.register_namespace('', NS)
ET.register_namespace('xhtml', XHTML)


def sitemap(entries):
    root = ET.Element(f'{{{NS}}}urlset')
    for url, alternates in entries:
        node = ET.SubElement(root, f'{{{NS}}}url')
        ET.SubElement(node, f'{{{NS}}}loc').text = url
        for lang, href in alternates:
            ET.SubElement(node, f'{{{XHTML}}}link',
                          rel='alternate', hreflang=lang, href=href)
    ET.indent(root, space='  ')
    return ET.tostring(root, encoding='utf-8', xml_declaration=True) + b'\n'


def guide_entries(root):
    """Only the selector, book homepages and rendered chapters are public pages."""
    for rel in ('index.html', 'es/index.html', 'en/index.html'):
        if not (root / rel).is_file():
            raise ValueError(f'Missing rendered guide page: {rel}')
    paths = {'index.html'}
    for lang in ('es', 'en'):
        paths.add(f'{lang}/index.html')
        paths.update(p.relative_to(root).as_posix()
                     for p in (root / lang / 'chapters').glob('*.html'))

    def url(path):
        return GUIDE if path == 'index.html' else GUIDE + quote(path, safe='/')

    home = [('es', url('es/index.html')), ('en', url('en/index.html')),
            ('x-default', GUIDE)]
    entries = [(GUIDE, home)]
    for path in sorted(paths - {'index.html'}):
        suffix = path.split('/', 1)[1]
        alternatives = home if suffix == 'index.html' else [
            (lang, url(f'{lang}/{suffix}')) for lang in ('es', 'en')
            if f'{lang}/{suffix}' in paths]
        entries.append((url(path), alternatives))
    return entries


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--taf-root', type=Path)
    parser.add_argument('--guide-root', type=Path, help='Rendered guide site directory')
    parser.add_argument('--check', action='store_true', help='Fail on drift; write nothing')
    args = parser.parse_args(argv)
    if args.taf_root is None and args.guide_root is None:
        parser.error('Specify --taf-root and/or --guide-root')
    outputs = []
    if args.taf_root is not None:
        if not (args.taf_root / 'index.html').is_file():
            parser.error('TAF root must contain index.html')
        outputs.extend((args.taf_root / name, sitemap([(base, [])]), 1)
                       for name, base in [('sitemap.xml', TAF), ('sitemap-hf.xml', HF)])
    if args.guide_root is not None:
        entries = guide_entries(args.guide_root)
        outputs.append((args.guide_root / 'sitemap.xml', sitemap(entries), len(entries)))
    failed = False
    for path, content, count in outputs:
        if args.check:
            matches = path.is_file() and path.read_text(encoding='utf-8') == content.decode('utf-8')
            failed |= not matches
            print(f'{"OK" if matches else "STALE"}: {path} ({count} URLs)')
        else:
            path.write_bytes(content)
            print(f'Wrote {path} ({count} URLs)')
    return int(failed)


if __name__ == '__main__':
    raise SystemExit(main())
