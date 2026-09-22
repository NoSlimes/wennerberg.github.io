#!/usr/bin/env python3
"""Combine content/ fragments into data/projects.yml.

Source of truth: content/. Run locally or via .github/workflows/content.yml.
"order" sets sort order (lowest first) and is stripped from output.
"""

from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "content"
DATA = ROOT / "data"
HEADER = (
    "# GENERATED FILE – do not edit.\n"
    "# Source: content/. Built by scripts/combine_projects.py\n"
)


def load_fragments(subdir):
    items = []
    folder = CONTENT / subdir
    if not folder.is_dir():
        return items
    for path in sorted(folder.glob("*.yml")):
        with open(path, encoding="utf-8") as fh:
            obj = yaml.safe_load(fh) or {}
        items.append((path.name, obj))
    return items


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
    summaries = [
        {k: v for k, v in item.items() if k != "order"}
        for item in ordered(load_fragments("projects"))
    ]
    with open(CONTENT / "meta.yml", encoding="utf-8") as fh:
        meta = yaml.safe_load(fh) or {}
    sections = {
        row["section"]: row.get("text", "")
        for row in meta.get("sections", [])
        if row.get("section")
    }
    out = DATA / "projects.yml"
    with open(out, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(HEADER)
        yaml.safe_dump(
            {"sectionDescriptions": sections, "summaries": summaries},
            fh,
            allow_unicode=True,
            width=1000,
            sort_keys=False,
            default_flow_style=False,
        )
    print(f"projects.yml: {len(summaries)} summaries, {len(sections)} sections")


if __name__ == "__main__":
    main()
