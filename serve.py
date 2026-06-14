#!/usr/bin/env python3
"""No-cache local dev server for TAF Agent.

`python -m http.server` lets the browser aggressively cache JS/CSS/HTML, so edits
don't show up on reload. This server sends `Cache-Control: no-store` on every
response, so each reload fetches the current files — no stale cache, no incognito needed.

Usage:
    python serve.py            # http://localhost:8000
    python serve.py 8090       # custom port
"""
import sys
import http.server
import socketserver

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
        print(f"TAF Agent (no-cache) at http://localhost:{PORT}   (Ctrl+C to stop)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")
