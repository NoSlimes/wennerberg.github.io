#!/usr/bin/env python3
"""Index data/projects/*.md into data/projects.yml (cards + section texts from
content/meta.yml), index data/experience/*.md into data/experiences.yml for the
sidebar, and write sitemap.xml from both.

Source of truth: the .md frontmatter. Run locally or via .github/workflows/content.yml.
"order" sets sort order (lowest first) and is stripped from output.
A project's id is its file name. Empty card fields fall back to the page's own.
"""

from pathlib import Path
from xml.sax.saxutils import escape

import yaml

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "content"
DATA = ROOT / "data"
SITE_URL = "https://wennerberg.dev"
# Fixed pages; projects and experiences are added from the data
SITEMAP_PAGES = ["/", "/about.html", "/resume.html"]
HEADER = (
    "# GENERATED FILE – do not edit.\n"
    "# Source: {source}. Built by scripts/combine_projects.py\n"
)


def ordered(items):
    def sort_key(pair):
        name, obj = pair
        try:
            order = float(obj.get("order", 9999))
        except (TypeError, ValueError):
            order = 9999
        return (order, name)

    return [obj for _, obj in sorted(items, key=sort_key)]


def main():
    summaries = build_project_summaries()
    with open(CONTENT / "meta.yml", encoding="utf-8") as fh:
        meta = yaml.safe_load(fh) or {}
    sections = {
        row["section"]: row.get("text", "")
        for row in meta.get("sections", [])
        if row.get("section")
    }
    out = DATA / "projects.yml"
    with open(out, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(HEADER.format(source="data/projects/*.md + content/meta.yml"))
        yaml.safe_dump(
            {"sectionDescriptions": sections, "summaries": summaries},
            fh,
            allow_unicode=True,
            width=1000,
            sort_keys=False,
            default_flow_style=False,
        )
    print(f"projects.yml: {len(summaries)} summaries, {len(sections)} sections")

    experiences = build_experiences()
    build_sitemap(summaries, experiences)


def card_summary(path, meta):
    """Card fields for the front page, in the shape the site's scripts read."""
    card = meta.get("card") or {}

    def pick(card_key, page_key):
        value = card.get(card_key)
        return value if value not in (None, "", []) else meta.get(page_key)

    declared = meta.get("id")
    if declared and declared != path.stem:
        raise SystemExit(f"{path.name}: id '{declared}' must match the file name")
    summary = {
        "order": meta.get("order", 9999),
        "id": path.stem,
        "title": pick("title", "projectName"),
        "navTitle": meta.get("navTitle"),
        "section": meta.get("section"),
        "projectType": pick("type", "projectType"),
        "flairs": pick("flairs", "flairs"),
        "description": card.get("description"),
        "imageSrc": pick("image", "heroImage"),
        "imageCaption": card.get("imageCaption"),
        "cardVideoUrl": pick("videoUrl", "heroVideoUrl"),
        "duration": card.get("duration"),
        "teamSize": card.get("teamSize"),
        "status": card.get("status"),
        "detailPageUrl": f"/project.html?id={path.stem}",
        "links": meta.get("links"),
        "highlighted": meta.get("highlighted"),
        "hidden": meta.get("hidden"),
        "locked": meta.get("locked"),
        "stub": meta.get("stub"),
    }
    return {k: v for k, v in summary.items() if v is not None}


def build_project_summaries():
    items = [
        (path.name, card_summary(path, read_frontmatter(path)))
        for path in sorted((DATA / "projects").glob("*.md"))
    ]
    return [{k: v for k, v in item.items() if k != "order"} for item in ordered(items)]


def read_frontmatter(path):
    text = path.read_text(encoding="utf-8")
    parts = text.split("---", 2)
    if len(parts) < 3 or parts[0].strip():
        return {}
    return yaml.safe_load(parts[1]) or {}


def build_experiences():
    """Index data/experience/*.md for the sidebar (the browser can't list folders)."""
    items = []
    for path in sorted((DATA / "experience").glob("*.md")):
        meta = read_frontmatter(path)
        items.append((path.name, {
            "order": meta.get("order", 9999),
            "id": path.stem,
            "navTitle": meta.get("navTitle") or meta.get("experienceName") or path.stem,
            "hidden": meta.get("hidden") is True,
            "locked": meta.get("locked") is True,
        }))
    experiences = [
        {k: v for k, v in item.items() if k != "order"}
        for item in ordered(items)
    ]
    out = DATA / "experiences.yml"
    with open(out, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(HEADER.format(source="data/experience/"))
        yaml.safe_dump(
            {"experiences": experiences},
            fh,
            allow_unicode=True,
            width=1000,
            sort_keys=False,
            default_flow_style=False,
        )
    print(f"experiences.yml: {len(experiences)} experiences")
    return experiences


def build_sitemap(projects, experiences):
    """Fixed pages plus every project and experience that isn't hidden or locked."""
    def visible(item):
        return item.get("hidden") is not True and item.get("locked") is not True

    paths = list(SITEMAP_PAGES)
    paths += [f"/experience.html?id={e['id']}" for e in experiences if visible(e)]
    paths += [f"/project.html?id={p['id']}" for p in projects if visible(p) and p.get("id")]

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        "<!-- GENERATED FILE – do not edit. Built by scripts/combine_projects.py;",
        "     hidden and locked projects and experiences are left out. -->",
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    lines += [f"  <url><loc>{escape(SITE_URL + path)}</loc></url>" for path in paths]
    lines.append("</urlset>")
    (ROOT / "sitemap.xml").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    print(f"sitemap.xml: {len(paths)} urls")


if __name__ == "__main__":
    main()
