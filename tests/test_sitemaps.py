"""Sitemap boundaries, language reciprocity and drift detection."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET
from urllib.parse import urlsplit

spec = importlib.util.spec_from_file_location(
    'build_sitemaps', Path(__file__).resolve().parents[1] / 'scripts/build_sitemaps.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class SitemapsTest(unittest.TestCase):
    def test_public_pages_and_reciprocal_languages(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for rel in ('index.html', 'en/index.html', 'es/index.html',
                        'en/chapters/01-intro.html', 'es/chapters/01-intro.html',
                        'en/assets/test.html', 'tmp/private.html'):
                path = root / rel
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('test', encoding='utf-8')
            entries = builder.guide_entries(root)
            self.assertEqual(len(entries), 5)
            mapping = dict(entries)
            self.assertEqual(len(mapping), 5)
            for url, alternatives in entries:
                self.assertTrue(url.startswith(builder.GUIDE))
                self.assertFalse(urlsplit(url).query or urlsplit(url).fragment)
                for _, href in alternatives:
                    self.assertIn(href, mapping)
                    self.assertEqual(mapping[href], alternatives)
            parsed = ET.fromstring(builder.sitemap(entries))
            self.assertEqual(len(parsed.findall(f'{{{builder.NS}}}url')), 5)
            self.assertNotIn(b'lastmod', builder.sitemap(entries))

    def test_taf_hosts_and_check_does_not_write(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'index.html').write_text('test')
            (root / 'test_banner.html').write_text('private test')
            args = ['--taf-root', tmp]
            self.assertEqual(builder.main(args), 0)
            for name, host in [('sitemap.xml', builder.TAF),
                               ('sitemap-hf.xml', builder.HF)]:
                parsed = ET.parse(root / name)
                urls = parsed.findall(f'.//{{{builder.NS}}}loc')
                self.assertEqual([node.text for node in urls], [host])
            self.assertEqual(builder.main(args + ['--check']), 0)
            (root / 'sitemap.xml').write_text('stale')
            self.assertEqual(builder.main(args + ['--check']), 1)
            self.assertEqual((root / 'sitemap.xml').read_text(), 'stale')

    def test_incomplete_render_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                builder.guide_entries(Path(tmp))


if __name__ == '__main__':
    unittest.main()
