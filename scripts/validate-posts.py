#!/usr/bin/env python3
"""
Validates that every entry in posts-meta.json has a matching .md file.

Usage:
  python3 scripts/validate-posts.py

Exits 0 on success, 1 if any files are missing.
"""

import json
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
META_PATH = os.path.join(REPO_ROOT, "assets", "data", "posts-meta.json")
POSTS_ROOT = os.path.join(REPO_ROOT, "blog", "posts")


def main():
    with open(META_PATH, "r") as f:
        posts = json.load(f)

    missing = []
    for post in posts:
        slug = post.get("slug", "")
        folder = post.get("folder", "")

        if folder:
            path = os.path.join(POSTS_ROOT, folder, slug + ".md")
        else:
            path = os.path.join(POSTS_ROOT, slug + ".md")

        if not os.path.isfile(path):
            rel = os.path.relpath(path, REPO_ROOT)
            missing.append(f"  MISSING  {rel}  (slug: {slug!r})")

    if missing:
        print(f"validate-posts: {len(missing)} missing file(s):\n")
        print("\n".join(missing))
        sys.exit(1)

    print(f"validate-posts: all {len(posts)} posts OK")


if __name__ == "__main__":
    main()
