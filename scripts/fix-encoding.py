# -*- coding: utf-8 -*-
from pathlib import Path

root = Path(r"c:\Users\admin\Desktop\vantage-web\src")
repls = {
    "\ufffd": "'",
    "\u2019": "'",
    "\u2018": "'",
    "\u201c": '"',
    "\u201d": '"',
    "\u2014": " - ",
    "\u2013": "-",
    "\u2026": "...",
    "\xb7": "-",
}
for p in list(root.rglob("*.ts")) + list(root.rglob("*.tsx")) + list(root.rglob("*.css")):
    t = p.read_text(encoding="utf-8", errors="replace")
    orig = t
    for bad, good in repls.items():
        t = t.replace(bad, good)
    if t != orig:
        p.write_text(t, encoding="utf-8", newline="\n")
        print("fixed", p.relative_to(root))
print("done")
