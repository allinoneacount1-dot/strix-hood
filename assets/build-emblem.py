"""Flatten the STRIX HOOD emblem (assets/logo.svg) into polygon contours.

Output: assets/logo-geo.json
  { view, shell:{outer,holes}, panel:{outer,holes}, brows:[ring,...],
    eyes:[ring,ring], pupils:[[x,y,r],...], beak:{...}, stem:[ring],
    traces:[{pts,s0}], nodes:[[x,y,r,s]], etch:[{pts}], traceW, etchW, sMax }

All coordinates are SVG space (y grows downward), same as wordmark-geo.json;
consumers flip y.

The hood is a *stroked* path: the artwork's silhouette is the fill outline
grown by half the stroke width and its dark interior is the same outline shrunk
by the same amount, with round joins. Both are extracted as the +w/2 and -w/2
level sets of the outline's signed distance field (marching squares, then
Douglas-Peucker), which is exactly what `stroke-linejoin:round` draws and is
immune to the self-intersections an analytic offset hits on the swept tips.
Everything else in the drawing is either a polygon already, a circle, or a
polyline the renderer strokes itself, so it is passed through as-is.

Build-time only (the JSON is committed): python3 assets/build-emblem.py
Requires numpy.
"""
import json
import math
import os
import re

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'logo.svg')
DST = os.path.join(HERE, 'logo-geo.json')

HOOD_STROKE = 9.0       # logo.svg hood stroke-width
CURVE_STEPS = 26        # samples per cubic
GRID = 0.09             # SDF cell size, artwork units
SIMPLIFY = 0.035        # Douglas-Peucker tolerance, artwork units


# ---------- SVG reading ----------

TOKEN = re.compile(r'[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?')


def cubic(p0, p1, p2, p3, steps):
    """Flatten one cubic, excluding t=0."""
    out = []
    for i in range(1, steps + 1):
        t = i / steps
        u = 1 - t
        a, b, c, d = u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t
        out.append([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
                    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]])
    return out


def parse_path(d, steps=CURVE_STEPS):
    """Absolute M/L/H/V/C/Z only — everything logo.svg uses. -> [{pts, closed}]"""
    toks = TOKEN.findall(d)
    subs, pts, cur, start, i, cmd = [], [], [0.0, 0.0], [0.0, 0.0], 0, None

    def flush(closed):
        if len(pts) > 1:
            subs.append({'pts': [p[:] for p in pts], 'closed': closed})

    while i < len(toks):
        t = toks[i]
        if re.match(r'[A-Za-z]', t):
            cmd = t
            i += 1
            if cmd in 'Zz':
                flush(True)
                pts[:] = []
                cur = start[:]
                continue
        if cmd is None:
            raise ValueError('path data starts without a command: ' + d[:40])
        n = float(toks[i])
        if cmd == 'M':
            flush(False)
            cur = [n, float(toks[i + 1])]
            start = cur[:]
            pts[:] = [cur[:]]
            i += 2
            cmd = 'L'                       # implicit lineto for extra pairs
        elif cmd == 'L':
            cur = [n, float(toks[i + 1])]
            pts.append(cur[:])
            i += 2
        elif cmd == 'H':
            cur = [n, cur[1]]
            pts.append(cur[:])
            i += 1
        elif cmd == 'V':
            cur = [cur[0], n]
            pts.append(cur[:])
            i += 1
        elif cmd == 'C':
            p1 = [n, float(toks[i + 1])]
            p2 = [float(toks[i + 2]), float(toks[i + 3])]
            p3 = [float(toks[i + 4]), float(toks[i + 5])]
            pts.extend(cubic(cur, p1, p2, p3, steps))
            cur = p3[:]
            i += 6
        else:
            raise ValueError('unsupported path command ' + cmd)
    flush(False)
    return subs


def read_svg(path):
    src = open(path).read()
    paths = [m.group(1) for m in re.finditer(r'<path[^>]*\sd="([^"]+)"', src)]
    circles = [[float(m.group(1)), float(m.group(2)), float(m.group(3))]
               for m in re.finditer(
                   r'<circle[^>]*cx="([-\d.]+)"[^>]*cy="([-\d.]+)"[^>]*r="([-\d.]+)"', src)]
    rects = [[float(m.group(i)) for i in range(1, 6)]
             for m in re.finditer(
                 r'<rect[^>]*x="([-\d.]+)"[^>]*y="([-\d.]+)"[^>]*width="([-\d.]+)"'
                 r'[^>]*height="([-\d.]+)"[^>]*rx="([-\d.]+)"', src)]
    return src, paths, circles, rects


# ---------- signed distance offset ----------

def signed_field(ring, xs, ys):
    """Signed distance to a closed polygon on a grid; positive outside."""
    X, Y = np.meshgrid(xs, ys)
    P = np.stack([X, Y], axis=-1).astype(np.float64)
    A = np.asarray(ring, dtype=np.float64)
    B = np.roll(A, -1, axis=0)
    d2 = np.full(X.shape, np.inf)
    inside = np.zeros(X.shape, dtype=bool)
    for a, b in zip(A, B):
        e = b - a
        L2 = e[0] * e[0] + e[1] * e[1]
        if L2 <= 0:
            continue
        w = P - a
        t = np.clip((w[..., 0] * e[0] + w[..., 1] * e[1]) / L2, 0.0, 1.0)
        cx = w[..., 0] - t * e[0]
        cy = w[..., 1] - t * e[1]
        np.minimum(d2, cx * cx + cy * cy, out=d2)
        # even-odd crossing test, vectorised
        cond = (a[1] > Y) != (b[1] > Y)
        with np.errstate(divide='ignore', invalid='ignore'):
            xint = (b[0] - a[0]) * (Y - a[1]) / (b[1] - a[1] + 1e-300) + a[0]
        inside ^= cond & (X < xint)
    d = np.sqrt(d2)
    return np.where(inside, -d, d)


def _key(p):
    return (round(p[0], 5), round(p[1], 5))


def marching(xs, ys, F, level):
    """Marching squares -> list of closed rings (SVG-space point lists)."""
    G = F - level
    s = G <= 0                                   # "inside" the level set
    a, b = s[:-1, :-1], s[:-1, 1:]               # tl, tr
    c, d = s[1:, 1:], s[1:, :-1]                 # br, bl
    case = (a.astype(np.uint8) | (b.astype(np.uint8) << 1) |
            (c.astype(np.uint8) << 2) | (d.astype(np.uint8) << 3))
    rows, cols = np.nonzero((case != 0) & (case != 15))

    def ix(v0, v1, x0, x1):                      # linear crossing on one edge
        t = v0 / (v0 - v1) if v0 != v1 else 0.5
        return x0 + (x1 - x0) * min(max(t, 0.0), 1.0)

    segs = []
    for j, i in zip(rows.tolist(), cols.tolist()):
        x0, x1, y0, y1 = xs[i], xs[i + 1], ys[j], ys[j + 1]
        g = (G[j, i], G[j, i + 1], G[j + 1, i + 1], G[j + 1, i])   # tl tr br bl
        top = (ix(g[0], g[1], x0, x1), y0)
        right = (x1, ix(g[1], g[2], y0, y1))
        bottom = (ix(g[3], g[2], x0, x1), y1)
        left = (x0, ix(g[0], g[3], y0, y1))
        k = int(case[j, i])
        # edges are emitted so the "inside" stays on the left
        table = {
            1: [(left, top)], 2: [(top, right)], 3: [(left, right)],
            4: [(right, bottom)], 6: [(top, bottom)], 7: [(left, bottom)],
            8: [(bottom, left)], 9: [(bottom, top)], 11: [(bottom, right)],
            12: [(right, left)], 13: [(right, top)], 14: [(top, left)],
        }
        if k in (5, 10):                          # saddle: resolve on cell mean
            mean = 0.25 * sum(g)
            if (mean <= 0) == (k == 5):
                table[k] = [(left, top), (right, bottom)] if k == 5 else [(top, right), (bottom, left)]
            else:
                table[k] = [(left, bottom), (right, top)] if k == 5 else [(top, left), (bottom, right)]
        segs.extend(table.get(k, []))

    # link segments head-to-tail into closed rings
    nxt = {}
    for p, q in segs:
        nxt.setdefault(_key(p), []).append((p, q))
    rings, used = [], set()
    for seg in segs:
        if id(seg) in used:
            continue
        chain = [seg[0], seg[1]]
        used.add(id(seg))
        for _ in range(len(segs) + 2):
            cand = nxt.get(_key(chain[-1]), [])
            step = None
            for s2 in cand:
                if id(s2) not in used:
                    step = s2
                    break
            if step is None:
                break
            used.add(id(step))
            chain.append(step[1])
            if _key(chain[-1]) == _key(chain[0]):
                break
        if len(chain) > 3 and _key(chain[-1]) == _key(chain[0]):
            rings.append([list(p) for p in chain[:-1]])
    rings.sort(key=lambda r: -abs(area(r)))
    return rings


def area(ring):
    s = 0.0
    for i in range(len(ring)):
        x0, y0 = ring[i]
        x1, y1 = ring[(i + 1) % len(ring)]
        s += x0 * y1 - x1 * y0
    return s / 2


def dp(pts, tol):
    """Douglas-Peucker on an open run."""
    if len(pts) < 3:
        return pts[:]
    ax, ay = pts[0]
    bx, by = pts[-1]
    dx, dy = bx - ax, by - ay
    L = math.hypot(dx, dy)
    far, fi = -1.0, 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        if L < 1e-12:
            d = math.hypot(px - ax, py - ay)
        else:
            d = abs(dy * (px - ax) - dx * (py - ay)) / L
        if d > far:
            far, fi = d, i
    if far <= tol:
        return [pts[0], pts[-1]]
    return dp(pts[:fi + 1], tol)[:-1] + dp(pts[fi:], tol)


def simplify_ring(ring, tol):
    n = len(ring)
    if n < 8:
        return ring
    # cut the loop at its extreme point so the join never eats a corner
    k = min(range(n), key=lambda i: (ring[i][1], ring[i][0]))
    run = ring[k:] + ring[:k + 1]
    out = dp(run, tol)
    return out[:-1]


def offset_rings(ring, dist, label):
    xs0 = [p[0] for p in ring]
    ys0 = [p[1] for p in ring]
    pad = abs(dist) + 6
    xs = np.arange(min(xs0) - pad, max(xs0) + pad, GRID)
    ys = np.arange(min(ys0) - pad, max(ys0) + pad, GRID)
    F = signed_field(ring, xs, ys)
    rings = marching(xs, ys, F, dist)
    if not rings:
        raise SystemExit('no contour extracted for ' + label)
    out = [simplify_ring(r, SIMPLIFY) for r in rings]
    print('  %-6s level %+.2f -> %d ring(s), %s pts, area %.0f'
          % (label, dist, len(out), [len(r) for r in out], abs(area(out[0]))))
    return out


# ---------- polyline helpers ----------

def plen(pts):
    return sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def s_at(traces, x, y):
    """Arc length (from the gem) of the point on the circuit nearest (x,y)."""
    best = (1e9, 0.0)
    for tr in traces:
        pts, s = tr['pts'], tr['s0']
        for i in range(len(pts) - 1):
            ax, ay = pts[i]
            bx, by = pts[i + 1]
            ex, ey = bx - ax, by - ay
            L2 = ex * ex + ey * ey or 1e-9
            t = max(0.0, min(1.0, ((x - ax) * ex + (y - ay) * ey) / L2))
            d = math.hypot(x - (ax + t * ex), y - (ay + t * ey))
            if d < best[0]:
                best = (d, s + t * math.sqrt(L2))
            s += math.sqrt(L2)
    return best[0] + best[1]


def rounded_rect(x, y, w, h, r, steps=6):
    pts = []
    for cx, cy, a0 in ((x + w - r, y + r, -math.pi / 2), (x + w - r, y + h - r, 0.0),
                       (x + r, y + h - r, math.pi / 2), (x + r, y + r, math.pi)):
        for i in range(steps + 1):
            a = a0 + math.pi / 2 * i / steps
            pts.append([cx + r * math.cos(a), cy + r * math.sin(a)])
    return pts


def rnd(ring, k=3):
    return [[round(p[0], k), round(p[1], k)] for p in ring]


# ---------- build ----------

def main():
    src, paths, circles, rects = read_svg(SRC)
    assert len(paths) == 16, 'expected 16 <path> in logo.svg, got %d' % len(paths)
    assert len(circles) == 10, 'expected 10 <circle>, got %d' % len(circles)
    assert len(rects) == 1, 'expected 1 <rect>, got %d' % len(rects)
    view = float(re.search(r'viewBox="0 0 (\d+)', src).group(1))

    hood = parse_path(paths[0])[0]['pts']
    if math.dist(hood[0], hood[-1]) < 1e-9:
        hood = hood[:-1]
    print('hood outline: %d pts' % len(hood))

    outer = offset_rings(hood, HOOD_STROKE / 2, 'outer')
    inner = offset_rings(hood, -HOOD_STROKE / 2, 'inner')

    # etch: inner bevel highlight (2 open runs) + crown seam. These are stroked
    # at runtime one capsule per segment, so the flattened curves are thinned
    # down to the points that actually carry the shape.
    etch = [{'pts': rnd(dp(s['pts'], 0.4))} for s in parse_path(paths[1])]
    etch += [{'pts': rnd(dp(s['pts'], 0.4))} for s in parse_path(paths[2])]

    brows = [rnd(parse_path(p)[0]['pts']) for p in paths[3:5]]
    eyes = [rnd(parse_path(p)[0]['pts']) for p in paths[5:7]]

    beak_ring = parse_path(paths[7])[0]['pts']          # M100 90 L114 106 L100 132 L86 106 Z
    bx = [p[0] for p in beak_ring]
    by = [p[1] for p in beak_ring]
    beak = {
        'cx': (min(bx) + max(bx)) / 2, 'x0': min(bx), 'x1': max(bx),
        'apexY': min(by), 'tipY': max(by),
        'waistY': sorted(by)[1],                        # the two side vertices
    }

    # circuit tracery: reordered so every run travels *outward from the gem*,
    # which is the direction the light packet reads in.
    raw = [parse_path(p)[0]['pts'] for p in paths[9:16]]
    order = [(0, False, 0.0), (1, False, 0.0), (2, False, 22.0), (3, False, 22.0),
             (4, True, 26.0), (5, True, 26.0), (6, False, 0.0)]
    traces = []
    for idx, rev, s0 in order:
        pts = raw[idx][::-1] if rev else raw[idx]
        traces.append({'pts': rnd(pts), 's0': round(s0, 3)})

    pupils = [[c[0], c[1], c[2]] for c in circles[:2]]
    nodes = [[c[0], c[1], c[2], round(s_at(traces, c[0], c[1]), 3)] for c in circles[2:]]
    sMax = max([t['s0'] + plen(t['pts']) for t in traces] + [n[3] for n in nodes])

    stem = rounded_rect(*rects[0])

    out = {
        'view': view,
        'shell': {'outer': [rnd(outer[0])], 'holes': [rnd(inner[0])]},
        'panel': {'outer': [rnd(inner[0])], 'holes': []},
        'brows': brows,
        'eyes': eyes,
        'pupils': pupils,
        'beak': {k: round(v, 3) for k, v in beak.items()},
        'stem': rnd(stem),
        'traces': traces,
        'traceW': 2.6,
        'etch': etch,
        'etchW': 2.4,
        'nodes': nodes,
        'sMax': round(sMax + 3.0, 3),
        'hoodStroke': HOOD_STROKE,
    }
    json.dump(out, open(DST, 'w'), separators=(',', ':'))
    print('wrote %s  (%.1f kB)' % (DST, os.path.getsize(DST) / 1024))
    print('  shell outer %d pts, inner %d pts | traces %d | nodes %d | sMax %.1f'
          % (len(outer[0]), len(inner[0]), len(traces), len(nodes), out['sMax']))


if __name__ == '__main__':
    main()
