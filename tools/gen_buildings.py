"""Regenerate the per-building summary entries (cat 大樓) in knowledge.json.

Run after editing entries:  python3 tools/gen_buildings.py
Each building gets one entry ("昌明樓有哪些單位") listing the units on each floor, built from the other entries.
"""
import json, re, pathlib
P = pathlib.Path(__file__).resolve().parent.parent / "knowledge.json"
kb = json.loads(P.read_text())
BUILDINGS = {  # place id → extra names people use
    "xingzheng": ["行政樓"], "xunxi": ["資訊大樓", "資訊樓"], "zhongke": ["中正大樓", "中科"], "changming": ["昌明"],
    "xuehuo": ["學活", "活動中心"], "zhongshang": ["中商"], "hanying": ["翰英"], "qixiu": ["奇秀"], "hongye": ["弘業"],
    "zhongji": ["中技"], "girls": ["女宿"], "boys": ["男宿"],
}
kb["entries"] = [e for e in kb["entries"] if e.get("cat") != "大樓"]
ALIAS = {"研究發展處": "研發處"}
clean = lambda s: ALIAS.get(re.sub(r"（.*?）", "", s), re.sub(r"（.*?）", "", s))
out = []
for pid, alias in BUILDINGS.items():
    name = kb["places"][pid]
    es = [e for e in kb["entries"] if e["place"] == pid and e.get("floor") is not None]
    if not es: continue
    floors = {}  # floor → {name: verified?}
    for e in sorted(es, key=lambda e: (e["floor"], e.get("room") or "")):
        d = floors.setdefault(e["floor"], {}); n = clean(e["office"]); d[n] = d.get(n, False) or e["verified"]
    lines = "；".join(f"{f} 樓：{'、'.join(n + ('' if ok else '*') for n, ok in d.items())}" for f, d in sorted(floors.items()))
    tbc = any(not ok for d in floors.values() for ok in d.values())
    out.append({"id": f"bldg-{pid}", "office": name, "place": pid, "floor": None, "room": "",
        "topics": [name, *alias, f"{name}有什麼", f"{name}有哪些單位"], "examples": [f"{name}有哪些單位", f"{name}在哪"],
        "answer": f"{name}目前收錄的單位——{lines}。" + ("（標 * 的資訊尚待確認）" if tbc else ""),
        "source": "由知識庫各條目自動彙整", "verified": True, "cat": "大樓", "label": name, "q": f"{name}有哪些單位？"})
kb["entries"] += out
if "大樓" not in kb["cats"]: kb["cats"].append("大樓")
P.write_text(json.dumps(kb, ensure_ascii=False, indent=1))
print(len(out), "building entries")
