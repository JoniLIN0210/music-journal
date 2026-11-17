#!/usr/bin/env python3
"""拉取网易云公开数据 → data/music.js（页面直接读取，无需服务器）。
用法： python3 fetch_data.py [uid]
精确播放次数需登录态，放在 data/playcounts.json（可选）。"""
import json, sys, time, subprocess, urllib.parse, pathlib

UID = int(sys.argv[1]) if len(sys.argv) > 1 else 420134554
ROOT = pathlib.Path(__file__).parent
HDR = {"User-Agent": "Mozilla/5.0", "Referer": "https://music.163.com/"}

def get(path, data=None):
    # 用系统 curl，避免 python.org 版 Python 缺证书的问题
    cmd = ["curl", "-s", "--max-time", "20", "-A", HDR["User-Agent"], "-e", HDR["Referer"]]
    if data:
        cmd += ["--data", urllib.parse.urlencode(data)]
    return json.loads(subprocess.run(cmd + ["https://music.163.com" + path],
                                     capture_output=True, check=True).stdout)

def pic(u):
    return (u or "").replace("http://", "https://").split("?")[0]

def song(s):
    return {"id": s["id"], "n": s["name"], "a": [a["name"] for a in s["ar"]],
            "al": s["al"]["name"], "pic": pic(s["al"].get("picUrl")),
            "dt": round(s.get("dt", 0) / 1000),
            "y": time.gmtime(s["publishTime"] / 1000).tm_year if s.get("publishTime") else None}

detail = get(f"/api/v1/user/detail/{UID}")
p = detail["profile"]
profile = {"uid": UID, "nick": p["nickname"], "avatar": pic(p["avatarUrl"]),
           "created": p["createTime"], "createDays": detail.get("createDays"),
           "listenSongs": detail.get("listenSongs"), "level": detail.get("level")}
if not profile["created"] or profile["created"] < 0:  # 匿名访问拿不到注册时间，用注册天数反推
    profile["created"] = int(time.time() * 1000) - (detail.get("createDays") or 0) * 86400000

pcs = {}
pcf = ROOT / "data/playcounts.json"
if pcf.exists():
    j = json.loads(pcf.read_text())
    pcs = {"a": dict(j["a"]), "w": dict(j["w"])}

def records(t, key):
    r = get(f"/api/v1/play/record?uid={UID}&type={t}")
    rows = r.get("allData" if t == 0 else "weekData") or []
    m = pcs.get(key, {})
    top = max([m.get(x["song"]["id"], 0) for x in rows] + [0])
    out = []
    for x in rows:
        d = song(x["song"]); d["score"] = x["score"]
        d["pc"] = m.get(d["id"]) or (round(x["score"] * top / 100) if top else None)
        out.append(d)
    return out

all_time, week = records(0, "a"), records(1, "w")

pls = get(f"/api/user/playlist?uid={UID}&limit=200&offset=0")["playlist"]
playlists = [{"id": x["id"], "n": x["name"], "c": x["trackCount"], "pc": x["playCount"],
              "pic": pic(x["coverImgUrl"]), "mine": x["creator"]["userId"] == UID,
              "ct": x["createTime"]} for x in pls]

liked_id = pls[0]["id"]
ids = get(f"/api/v6/playlist/detail?id={liked_id}&n=2000")["playlist"]["trackIds"]
songs = {}
for i in range(0, len(ids), 200):
    c = json.dumps([{"id": t["id"]} for t in ids[i:i+200]])
    for s in get("/api/v3/song/detail", {"c": c}).get("songs", []):
        songs[s["id"]] = s
liked = []
for t in ids:
    if t["id"] in songs:
        d = song(songs[t["id"]]); d["at"] = t["at"]; liked.append(d)

out = {"profile": profile, "allTime": all_time, "week": week,
       "playlists": playlists, "liked": liked, "fetchedAt": int(time.time() * 1000)}
(ROOT / "data/music.js").write_text("window.MUSIC = " + json.dumps(out, ensure_ascii=False) + ";\n")
print(f"ok · {len(all_time)} all-time · {len(week)} week · {len(liked)} liked · {len(playlists)} playlists")
