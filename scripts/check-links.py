#!/usr/bin/env python3
"""
Checks every href in index.html and blog/view.html for broken internal links.

Rules:
  - Skips external URLs (http/https)
  - Skips mailto: and javascript: hrefs
  - Resolves all relative hrefs against the file's location
  - Reports any resolved path that does not exist on disk
  - Exits 0 if all OK, 1 if any broken links found

Usage:
  python3 scripts/check-links.py
"""

import os
import re
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# HTML files to scan
HTML_FILES = [
    os.path.join(REPO_ROOT, "index.html"),
    os.path.join(REPO_ROOT, "blog", "view.html"),
]

HREF_RE = re.compile(r'href=["\']([^"\']+)["\']', re.IGNORECASE)
SRC_RE  = re.compile(r'src=["\']([^"\']+)["\']',  re.IGNORECASE)

SKIP_PREFIXES = ("http://", "https://", "mailto:", "javascript:", "#", "//")


def check_file(html_path: str) -> list[str]:
    errors = []
    base_dir = os.path.dirname(html_path)

    with open(html_path, "r", encoding="utf-8") as f:
        content = f.read()

    refs = HREF_RE.findall(content) + SRC_RE.findall(content)

    for ref in refs:
        # Strip query string and fragment for file-existence check
        clean = ref.split("?")[0].split("#")[0]

        if not clean or any(clean.startswith(p) for p in SKIP_PREFIXES):
            continue

        abs_path = os.path.normpath(os.path.join(base_dir, clean))

        # Allow directory references (resolve to index.html implicitly)
        if not os.path.exists(abs_path):
            rel_html = os.path.relpath(html_path, REPO_ROOT)
            errors.append(f"  BROKEN  {ref!r}  (in {rel_html})")

    return errors


def main():
    all_errors = []

    for html_file in HTML_FILES:
        if not os.path.isfile(html_file):
            print(f"check-links: skipping missing file: {html_file}")
            continue
        errors = check_file(html_file)
        all_errors.extend(errors)

    if all_errors:
        print(f"check-links: {len(all_errors)} broken link(s):\n")
        print("\n".join(all_errors))
        sys.exit(1)

    print(f"check-links: all links OK")


if __name__ == "__main__":
    main()
