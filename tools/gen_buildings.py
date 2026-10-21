"""Regenerate the per-building summary entries (cat 大樓) in knowledge.json.

Run after editing entries:  python3 tools/gen_buildings.py
Each building gets one entry ("昌明樓有哪些單位") listing the units on each floor, built from the other entries.
"""
import json, re, pathlib
P = pathlib.Path(__file__).resolve().parent.parent / "knowledge.json"
kb = json.loads(P.read_text())
BUILDINGS = {  # place id → extra names people use
    "xingzheng": ["行政樓"], "xunxi": ["資訊大樓", "資訊樓"], "zhongke": ["中正大樓", "中科"], "changming": ["昌明", "昌平樓"],
    "xuehuo": ["學活", "活動中心"], "zhongshang": ["中商"], "hanying": ["翰英"], "qixiu": ["奇秀"], "hongye": ["弘業"],
    "zhongji": ["中技"], "girls": ["女宿"], "boys": ["男宿"],
}
kb["entries"] = [e for e in kb["entries"] if e.get("cat") != "大樓"]
ALIAS = {"研究發展處": "研發處"}
clean = lambda s: ALIAS.get(re.sub(r"（.*?）", "", s), re.sub(r"（.*?）", "", s))
out = []
for pid, alias in BUILDINGS.items():
    name = kb["places"][pid]
    es = [e for e in kb["entries"] if e["place"] == pid and e.get("floor") is not None and not e.get("cat", "").startswith("_")]
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
kb["entries"] = [e for e in kb["entries"] if e.get("cat") != "_office"]
for e in [x for x in kb["entries"] if not x.get("cat", "").startswith("_")]:  # 「課外活動指導組（課指組）」→ 課指組 is a topic of every entry of that office
    for ab in re.findall(r"（(.*?)）", e["office"]):
        if 1 < len(ab) <= 6 and ab not in e["topics"]: e["topics"].append(ab)
by = {}
for e in kb["entries"]:
    if e.get("cat") in ("大樓",) or e.get("cat", "").startswith("_") or not e.get("place") or e.get("floor") is None: continue
    by.setdefault(e["office"], []).append(e)
for office, es in by.items():
    tasks = [x.get("label") or x["examples"][0] for x in es if x.get("label") or x["examples"]]
    if len(es) < 2 or len(set(tasks)) < 2: continue
    e0 = es[0]; name = clean(office); abbr = re.findall(r"（(.*?)）", office)
    room = f" {e0['room']}" if e0.get("room") else ""
    out.append({"id": "office-" + e0["id"], "office": office, "place": e0["place"], "floor": e0["floor"], "room": e0.get("room", ""),
        "topics": [name, *abbr, f"{name}在哪", f"{name}辦什麼"], "examples": [f"{name}在哪", f"{(abbr or [name])[0]}在哪"],
        "answer": f"{office}在{kb['places'][e0['place']]} {e0['floor']} 樓{room}，可以辦：{'、'.join(dict.fromkeys(tasks))}。",
        "source": "由知識庫各條目自動彙整", "verified": all(x["verified"] for x in es), "cat": "_office"})
kb["entries"] += out
if "大樓" not in kb["cats"]: kb["cats"].append("大樓")
# 「你可以問什麼？」— an overview of what the knowledge base covers, rebuilt every run
kb["entries"] = [e for e in kb["entries"] if e.get("cat") != "_help"]
groups = {}
for e in kb["entries"]:
    c = e.get("cat", "")
    if c and not c.startswith("_") and c != "大樓": groups.setdefault(c, []).append(e.get("label") or clean(e["office"]))
parts = []
for c in [x for x in kb.get("cats", []) if x in groups]:
    names = list(dict.fromkeys(groups[c])); ex = "、".join(names[:4])
    parts.append(f"・{c}：{ex}{'…等 ' + str(len(names)) + ' 項' if len(names) > 4 else ''}")
nfac = sum(1 for e in kb["entries"] if e.get("cat") == "_faculty")
kb["entries"].append({"id": "help", "office": "「問」可以回答什麼", "place": None, "floor": None, "room": "",
    "topics": ["你可以問什麼", "可以問什麼", "能問什麼", "有哪些資訊", "有什麼資訊", "你會什麼", "你能做什麼", "怎麼用", "使用說明", "功能", "help", "你是誰"],
    "examples": ["你有哪些資訊可以問？", "你可以幫我什麼"],
    "answer": "我可以告訴你要去哪棟幾樓、找哪個單位、辦事要跑哪幾站，並在地圖上帶路。目前收錄：\n" + "\n".join(parts)
        + (f"\n・老師研究室：國貿系 {nfac} 位" if nfac else "") + "\n也可以直接輸入教室編號（如 3705）或大樓名稱（如「昌明樓」）。完整清單在首頁「問 v1.0」。",
    "source": "由知識庫自動彙整", "verified": True, "cat": "_help"})
P.write_text(json.dumps(kb, ensure_ascii=False, indent=1))
print(len(out), "building entries")
