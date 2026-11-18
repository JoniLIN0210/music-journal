#!/usr/bin/env python3
"""给听歌手记补"唱片内页"的硬信息 → data/credits.js
来源全部是网易云公开接口：歌曲署名（作词/作曲/编曲/制作，取自歌词开头的署名行，不保存歌词本身）、
专辑发行时间与厂牌、艺人的专辑数与歌曲数。范围：Top 100 歌曲 + 前 15 位艺人。
用法：python3 fetch_credits.py"""
import json, re, time, subprocess, urllib.parse, pathlib

ROOT = pathlib.Path(__file__).parent

def get(path, data=None):
    cmd = ["curl", "-s", "--max-time", "20", "-A", "Mozilla/5.0", "-e", "https://music.163.com/"]
    if data:
        cmd += ["--data", urllib.parse.urlencode(data)]
    out = subprocess.run(cmd + ["https://music.163.com" + path], capture_output=True).stdout
    try:
        return json.loads(out)
    except Exception:
        return {}

m = json.loads(re.search(r"window\.MUSIC = (.*);\s*$", (ROOT / "data/music.js").read_text(), re.S).group(1))
top = m["allTime"][:100]

# 歌曲详情：专辑 id、艺人 id
det = {}
c = json.dumps([{"id": s["id"]} for s in top])
for s in get("/api/v3/song/detail", {"c": c}).get("songs", []):
    det[s["id"]] = s

ROLE = re.compile(r"^\s*(作词|作曲|编曲|制作人|制作|监制|混音|母带|录音|吉他|贝斯|鼓|键盘|和声|弦乐|出品|OP|SP)\s*[:：]\s*(.+?)\s*$")
songs, albums_seen = {}, {}
for s in top:
    sid = s["id"]; d = det.get(sid, {})
    lrc = get(f"/api/song/lyric?id={sid}&lv=1").get("lrc", {}).get("lyric", "")
    cr = []
    for line in lrc.split("\n")[:24]:              # 署名只在开头几行
        mm = ROLE.match(re.sub(r"^\[[^\]]*\]", "", line))
        if mm and len(cr) < 8:
            cr.append([mm.group(1), mm.group(2)[:40]])
    al = d.get("al") or {}
    if al.get("id") and al["id"] not in albums_seen:
        a = get(f"/api/v1/album/{al['id']}").get("album", {})
        albums_seen[al["id"]] = {"id": al["id"], "n": a.get("name") or al.get("name"),
            "pub": a.get("publishTime"), "co": a.get("company") or "", "size": a.get("size"), "type": a.get("type") or ""}
        time.sleep(.15)
    songs[sid] = {"cr": cr, "al": al.get("id"), "ar": [x["id"] for x in d.get("ar", [])]}
    time.sleep(.15)

# 前 15 位艺人
pc = {}
for s in top:
    for a in s["a"]:
        pc[a] = pc.get(a, 0) + (s.get("pc") or 0)
names = [a for a, _ in sorted(pc.items(), key=lambda x: -x[1])[:15]]
ids = {}
for s in top:
    for x in det.get(s["id"], {}).get("ar", []):
        ids.setdefault(x["name"], x["id"])
artists = {}
for n in names:
    if n not in ids: continue
    a = get(f"/api/v1/artist/{ids[n]}").get("artist", {})
    artists[n] = {"id": ids[n], "albums": a.get("albumSize"), "songs": a.get("musicSize"), "alias": (a.get("alias") or a.get("trans") and [a.get("trans")] or [])[:2],
                  "pic": (a.get("picUrl") or a.get("img1v1Url") or "").replace("http://", "https://").split("?")[0]}
    time.sleep(.15)

out = {"updatedAt": int(time.time() * 1000), "songs": songs, "albums": albums_seen, "artists": artists}
(ROOT / "data/credits.js").write_text("/* 唱片内页硬信息，来自网易云公开接口（fetch_credits.py 生成）。不含歌词。 */\nwindow.CREDITS = "
                                      + json.dumps(out, ensure_ascii=False) + ";\n")
print(f"ok · {len(songs)} songs ({sum(1 for v in songs.values() if v['cr'])} with credits) · {len(albums_seen)} albums · {len(artists)} artists")
