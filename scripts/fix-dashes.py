# -*- coding: utf-8 -*-
from pathlib import Path
import re

root = Path(r"c:\Users\admin\Desktop\vantage-web\src")
for p in list(root.rglob("*.ts")) + list(root.rglob("*.tsx")):
    t = p.read_text(encoding="utf-8")
    n = re.sub(r"(\w) ' (\w)", r"\1 - \2", t)
    n = n.replace(" ' ", " - ")
    if n != t:
        p.write_text(n, encoding="utf-8", newline="\n")
        print("fixed", p.relative_to(root))
print("done")
