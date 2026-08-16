"""Flatten the STRIX HOOD wordmark into polygon contours.

Output: assets/wordmark-geo.json
  { unitsPerEm, top, cap, baseline, glyphs: [
      { c, x, w, outer: [[ [x,y], ... ], ...], holes: [[ [x,y], ... ], ...] } ] }
All coordinates are SVG space (y grows downward). Consumers flip y.
Solid glyphs are emitted as a union of convex pieces, which extrudes
identically to the union and avoids any boolean geometry at runtime.
"""
import json, math

TOP, CAP = 262.0, 170.0
BOT = TOP + CAP
T = 44.0        # STRIX stem weight
OUT = 20.0      # HOOD stroke weight

def R(x, y, w, h):
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]

def arc(cx, cy, r, a0, a1, steps=14):
    return [[cx + r * math.cos(a0 + (a1 - a0) * i / steps),
             cy + r * math.sin(a0 + (a1 - a0) * i / steps)] for i in range(steps + 1)]

def rounded(x0, y0, x1, y1, r, square_left=False):
    """Clockwise rounded rectangle in SVG space."""
    pts = []
    if square_left:
        pts.append([x0, y0])
        pts += arc(x1 - r, y0 + r, r, -math.pi / 2, 0)
        pts += arc(x1 - r, y1 - r, r, 0, math.pi / 2)
        pts.append([x0, y1])
    else:
        pts += arc(x0 + r, y0 + r, r, math.pi, math.pi * 1.5)
        pts += arc(x1 - r, y0 + r, r, -math.pi / 2, 0)
        pts += arc(x1 - r, y1 - r, r, 0, math.pi / 2)
        pts += arc(x0 + r, y1 - r, r, math.pi / 2, math.pi)
    return pts

# ---------- solid glyphs ----------
def S(x, w):
    mid = TOP + CAP / 2
    return [R(x, TOP, w, T),
            R(x, TOP, T, CAP / 2 + T / 2),
            R(x, mid - T / 2, w, T),
            R(x + w - T, mid - T / 2, T, CAP / 2 + T / 2),
            R(x, BOT - T, w, T)]

def Tg(x, w):
    return [R(x, TOP, w, T), R(x + w / 2 - T / 2, TOP, T, CAP)]

def Rg(x, w):
    bowl, legw = CAP * 0.56, T * 0.98
    lx = x + w * 0.40
    return [R(x, TOP, T, CAP),
            R(x, TOP, w, T),
            R(x + w - T, TOP, T, bowl),
            R(x, TOP + bowl - T, w, T),
            [[lx, TOP + bowl - T], [lx + legw, TOP + bowl - T], [x + w, BOT], [x + w - legw, BOT]]]

def Ig(x, w):
    return [R(x, TOP, w, CAP)]

def Xg(x, w):
    s = T * 1.02
    return [[[x, TOP], [x + s, TOP], [x + w, BOT], [x + w - s, BOT]],
            [[x + w - s, TOP], [x + w, TOP], [x + s, BOT], [x, BOT]]]

# ---------- outlined glyphs (stroke converted to fill) ----------
def Hg(x, w):
    return [R(x, TOP, OUT, CAP),
            R(x + w - OUT, TOP, OUT, CAP),
            R(x, TOP + CAP / 2 - OUT / 2, w, OUT)], []

def Og(x, w):
    r = min((w - OUT) / 2, (CAP - OUT) / 2) * 0.72 + OUT / 2
    outer = rounded(x, TOP, x + w, BOT, r)
    inner = rounded(x + OUT, TOP + OUT, x + w - OUT, BOT - OUT, max(2.0, r - OUT))
    return [outer], [inner]

def Dg(x, w):
    r = min((w - OUT) / 2, (CAP - OUT) / 2) * 0.72 + OUT / 2
    outer = rounded(x, TOP, x + w, BOT, r, square_left=True)
    inner = rounded(x + OUT, TOP + OUT, x + w - OUT, BOT - OUT, max(2.0, r - OUT), square_left=True)
    return [outer], [inner]

glyphs, x = [], 236.0
for c, fn, w in [("S", S, 158), ("T", Tg, 160), ("R", Rg, 158), ("I", Ig, 46), ("X", Xg, 172)]:
    glyphs.append({"c": c, "x": x, "w": w, "style": "solid", "outer": fn(x, w), "holes": []})
    x += w + 34
strix_end = x - 34

x = strix_end + 96
for c, fn, w in [("H", Hg, 138), ("O", Og, 142), ("O", Og, 142), ("D", Dg, 138)]:
    outer, holes = fn(x, w)
    glyphs.append({"c": c, "x": x, "w": w, "style": "outline", "outer": outer, "holes": holes})
    x += w + 30
hood_end = x - 30

icx = [g for g in glyphs if g["c"] == "I"][0]
cx, dy, ds = icx["x"] + icx["w"] / 2, TOP - 44, 34
diamond = [[cx, dy - ds / 2], [cx + ds / 2, dy], [cx, dy + ds / 2], [cx - ds / 2, dy]]

out = {
    "top": TOP, "cap": CAP, "baseline": BOT, "stem": T, "outlineWeight": OUT,
    "left": 236.0, "strixEnd": strix_end, "hoodStart": strix_end + 96, "right": hood_end,
    "glyphs": glyphs,
    "accent": {"c": "diamond", "outer": [diamond], "holes": [], "style": "accent",
               "x": cx - ds / 2, "w": ds}
}
json.dump(out, open('/tmp/strix-hood/assets/wordmark-geo.json', 'w'), separators=(',', ':'))
print("glyphs", len(glyphs), "| strix", 236.0, strix_end, "| hood", strix_end + 96, hood_end)
