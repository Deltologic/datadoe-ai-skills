"""Build the animated SVGs that README.md shows.

Run from the repository root: python3 .github/readme/build.py
Run it again after adding or changing a skill: every number in the images is counted from the
frontmatter of skills/*/SKILL.md (metadata.title, category, access, interface, output, youtube-video-embed-url).
Optional: --repo PATH reads skills/ from another checkout.

GitHub shows README images through <img>, so the SVGs use only what works there:
inline CSS, SMIL animation, system fonts, no scripts, no external files.
Colours are the DataDoe palette (teal #00ffdd on dark green #071a18). datadoe-logo-teal.svg
next to this file is the official DataDoe logo for dark backgrounds; its paths are used unchanged.
The drawing helpers match .github/readme/build.py in Deltologic/datadoe-mcp. No third-party packages.
"""

from __future__ import annotations

import argparse
import datetime as dt
import math
import random
import re
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
LOGO = HERE / "datadoe-logo-teal.svg"

TEAL = "#00ffdd"
DARK = "#071a18"
PANEL = "#0c2723"
WHITE = "#ffffff"
SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
PILL_TEXT = 17
MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace"

# The order of tests/validate-skills.ts allowedCategories.
CATEGORIES = ["Reporting", "Profit & Finance", "Account Health", "PPC & Ads", "Inventory", "Listings & Content", "Search & SEO"]
# What the skills hand back, as their descriptions in README.md say it.
OUTPUTS = ["Report in chat", "HTML dashboard", "Excel planner", "Slack or email alert", "Runnable app"]
TAGLINES = [
    "one prompt, one Amazon report, alert or app",
    "Claude  ·  ChatGPT  ·  Cursor  ·  Claude Code  ·  Codex",
    "read-only by default, writes only after your OK",
]


# ---------------------------------------------------------------- counts


def frontmatter(text: str) -> dict[str, str]:
    """The flat keys of a SKILL.md frontmatter (name plus metadata.*), without a YAML package."""
    match = re.match(r"^---\r?\n(.*?)\r?\n---", text, re.S)
    out: dict[str, str] = {}
    for line in (match.group(1) if match else "").splitlines():
        m = re.match(r"^\s*([a-z-]+):\s*(.+?)\s*$", line)
        if m and m.group(2) not in (">-", "|", ">"):
            out.setdefault(m.group(1), m.group(2).strip("'\""))
    return out


class Repo:
    """Everything the images count, read once from skills/*/SKILL.md."""

    def __init__(self, root: Path) -> None:
        self.skills = []
        for path in sorted((root / "skills").glob("*/SKILL.md")):
            meta = frontmatter(path.read_text())
            meta.setdefault("title", path.parent.name)
            self.skills.append(meta)

    def count(self, key: str, *values: str) -> int:
        return sum(1 for s in self.skills if s.get(key) in values)

    def by_category(self) -> list[tuple[str, list[dict[str, str]]]]:
        used = Counter(s.get("category") for s in self.skills)
        order = CATEGORIES + sorted(c for c in used if c not in CATEGORIES)
        return [(c, [s for s in self.skills if s.get("category") == c]) for c in order if used[c]]


def esc(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# ---------------------------------------------------------------- shared pieces


def svg(width: float, height: float, body: str, style: str = "") -> str:
    reduced = "@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }"
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
        f'width="{width}" height="{height}" role="img">\n'
        f"<style>{style}\n{reduced}</style>\n{body}\n</svg>\n"
    )


def logo(x: float, y: float, width: float) -> str:
    """The teal DataDoe logo as a nested <svg>, paths untouched."""
    src = LOGO.read_text()
    view_box = re.search(r'viewBox="([^"]+)"', src).group(1)
    vb = [float(v) for v in view_box.split()]
    inner = src[src.index(">") + 1 : src.rindex("</svg>")]
    inner = inner.replace('id="ear"', 'id="dd-ear"').replace("url(#ear)", "url(#dd-ear)")
    height = width * vb[3] / vb[2]
    return f'<svg x="{x}" y="{y}" width="{width:.1f}" height="{height:.1f}" viewBox="{view_box}">{inner}</svg>'


def glow_filter(fid: str) -> str:
    return (
        f'<filter id="{fid}" x="-200%" y="-200%" width="500%" height="500%">'
        f'<feGaussianBlur stdDeviation="3" result="b"/>'
        f'<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
    )


def label(x: float, y: float, text: str, anchor: str = "start", size: int = 14) -> str:
    return (
        f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-family="{MONO}" font-size="{size}" letter-spacing="3" '
        f'fill="{TEAL}" fill-opacity=".8">{esc(text)}</text>'
    )


def pill(x: float, y: float, w: float, text: str, delay: float, strong: bool = False) -> str:
    fill, ink = (TEAL, DARK) if strong else (PANEL, WHITE)
    dot = DARK if strong else TEAL
    return f"""
<g>
  <rect x="{x}" y="{y}" width="{w}" height="32" rx="16" fill="{fill}" stroke="{TEAL}" stroke-opacity=".45"/>
  <circle cx="{x + 16}" cy="{y + 16}" r="4.5" fill="{dot}">
    <animate attributeName="opacity" values="1;.25;1" dur="2.4s" begin="{delay:.2f}s" repeatCount="indefinite"/>
  </circle>
  <text x="{x + 30}" y="{y + 21.5}" font-family="{MONO}" font-size="{PILL_TEXT}" font-weight="{700 if strong else 400}" fill="{ink}">{esc(text)}</text>
</g>"""


def flow(path_id: str, d: str, dur: float, delay: float, both_ways: bool = False) -> str:
    """A faint path with a marching dash and glowing packets; both_ways sends a white packet back."""
    back = (
        f'<circle r="2.5" fill="{WHITE}">'
        f'<animateMotion dur="{dur:.2f}s" begin="-{delay + dur / 2:.2f}s" repeatCount="indefinite" '
        f'keyPoints="1;0" keyTimes="0;1" calcMode="linear"><mpath href="#{path_id}"/></animateMotion></circle>'
        if both_ways
        else f'<circle r="2" fill="{WHITE}"><animateMotion dur="{dur:.2f}s" begin="-{delay + dur / 2:.2f}s" '
        f'repeatCount="indefinite"><mpath href="#{path_id}"/></animateMotion></circle>'
    )
    return f"""
<path id="{path_id}" d="{d}" fill="none" stroke="{TEAL}" stroke-opacity=".18" stroke-width="1.5"/>
<path d="{d}" fill="none" stroke="{TEAL}" stroke-opacity=".5" stroke-width="1.5" stroke-dasharray="3 14">
  <animate attributeName="stroke-dashoffset" from="34" to="0" dur="1.2s" repeatCount="indefinite"/>
</path>
<circle r="3.5" fill="{TEAL}" filter="url(#glow)">
  <animateMotion dur="{dur:.2f}s" begin="-{delay:.2f}s" repeatCount="indefinite"><mpath href="#{path_id}"/></animateMotion>
</circle>
{back}"""


def stars(w: float, h: float, count: int, seed: int) -> str:
    rnd = random.Random(seed)
    out = []
    for _ in range(count):
        x, y = rnd.uniform(0, w), rnd.uniform(0, h)
        r = rnd.uniform(0.5, 1.7)
        base = rnd.uniform(0.15, 0.5)
        dur = rnd.uniform(2, 6)
        fill = WHITE if rnd.random() < 0.6 else TEAL
        out.append(
            f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.1f}" fill="{fill}" opacity="{base:.2f}">'
            f'<animate attributeName="opacity" values="{base:.2f};1;{base:.2f}" dur="{dur:.1f}s" '
            f'begin="-{rnd.uniform(0, dur):.1f}s" repeatCount="indefinite"/></circle>'
        )
    return "".join(out)


def neon_floor(w: float, h: float, horizon: float) -> str:
    vx = w / 2
    out = []
    for i in range(-18, 19):
        out.append(
            f'<line x1="{vx + i * 5:.0f}" y1="{horizon}" x2="{vx + i * 110:.0f}" y2="{h}" '
            f'stroke="{TEAL}" stroke-opacity=".09"/>'
        )
    n = 11
    ys = [horizon + (h - horizon) * (k / n) ** 2 for k in range(n + 2)]
    for k in range(n + 1):
        y0, y1 = ys[k], ys[k + 1]
        op = 0.04 + 0.16 * k / n
        out.append(
            f'<line x1="0" x2="{w}" y1="{y0:.1f}" y2="{y0:.1f}" stroke="{TEAL}" stroke-opacity="{op:.2f}">'
            f'<animate attributeName="y1" values="{y0:.1f};{y1:.1f}" dur="1.4s" repeatCount="indefinite"/>'
            f'<animate attributeName="y2" values="{y0:.1f};{y1:.1f}" dur="1.4s" repeatCount="indefinite"/>'
            f"</line>"
        )
    return "".join(out)


def taglines(cy: float) -> str:
    """Typing text that writes, holds and deletes each tagline in turn."""
    total, slot, size = 15.0, 5.0, 21
    char = size * 0.6
    defs, body = [], []
    for i, text in enumerate(TAGLINES):
        line = "&gt; " + esc(text)
        width = (len(text) + 2) * char
        x0 = 640 - width / 2
        s = i * slot + 0.2
        keys = [0, s, s + 1.8, s + 4.1, s + 4.6, total]
        kt = ";".join(f"{k / total:.4f}" for k in keys)
        defs.append(
            f'<clipPath id="tl{i}"><rect x="{x0 - 2:.1f}" y="{cy - 22}" height="32" width="0">'
            f'<animate attributeName="width" values="0;0;{width + 4:.1f};{width + 4:.1f};0;0" keyTimes="{kt}" '
            f'dur="{total}s" repeatCount="indefinite"/></rect></clipPath>'
        )
        on = f"{s / total:.4f};{(s + 4.6) / total:.4f}"
        body.append(
            f'<text x="{x0:.1f}" y="{cy}" font-family="{MONO}" font-size="{size}" fill="{WHITE}" '
            f'fill-opacity=".88" clip-path="url(#tl{i})" style="white-space:pre">{line}</text>'
            f'<rect y="{cy - 17}" width="10" height="21" fill="{TEAL}" opacity="0">'
            f'<animate attributeName="x" values="{x0:.1f};{x0:.1f};{x0 + width + 4:.1f};{x0 + width + 4:.1f};{x0:.1f};{x0:.1f}" '
            f'keyTimes="{kt}" dur="{total}s" repeatCount="indefinite"/>'
            f'<animate attributeName="opacity" calcMode="discrete" values="0;1;0" keyTimes="0;{on}" '
            f'dur="{total}s" repeatCount="indefinite"/></rect>'
        )
    return "<defs>" + "".join(defs) + "</defs>" + "".join(body)


def glitch_title(text: str, y: float, size: int = 70) -> str:
    common = (
        f'x="640" y="{y}" text-anchor="middle" font-family="{SANS}" font-size="{size}" '
        f'font-weight="800" letter-spacing="9"'
    )
    burst = (
        'calcMode="discrete" values="0;1;0;1;0;1;0" keyTimes="0;.70;.715;.73;.745;.76;.775" '
        'dur="6s" repeatCount="indefinite"'
    )
    return f"""
<defs>
  <clipPath id="slice-a"><rect x="0" y="{y - 52}" width="1280" height="14">
    <animate attributeName="y" calcMode="discrete" values="{y - 52};{y - 30};{y - 44};{y - 14}" dur=".4s" repeatCount="indefinite"/>
  </rect></clipPath>
  <clipPath id="slice-b"><rect x="0" y="{y - 20}" width="1280" height="10">
    <animate attributeName="y" calcMode="discrete" values="{y - 20};{y - 48};{y - 8};{y - 36}" dur=".3s" repeatCount="indefinite"/>
  </rect></clipPath>
</defs>
<text {common} fill="url(#shine)">{text}</text>
<g opacity="0">
  <animate attributeName="opacity" {burst}/>
  <rect x="0" y="{y - 60}" width="1280" height="72" fill="{DARK}" opacity=".35"/>
  <text {common} fill="{WHITE}" clip-path="url(#slice-a)" transform="translate(-9 0)">{text}</text>
  <text {common} fill="{TEAL}" clip-path="url(#slice-b)" transform="translate(11 0)">{text}</text>
  <text {common} fill="none" stroke="{TEAL}" stroke-width="1" transform="translate(3 2)">{text}</text>
</g>"""


def polar(cx: float, cy: float, r: float, deg: float) -> tuple[float, float]:
    a = math.radians(deg)
    return cx + r * math.sin(a), cy - r * math.cos(a)


def core(cx: float, cy: float, text: str, text_size: int = 31) -> str:
    wedges = []
    for k in range(10):
        x0, y0 = polar(cx, cy, 64, -k * 4)
        x1, y1 = polar(cx, cy, 64, -(k + 1) * 4)
        wedges.append(
            f'<path d="M{cx} {cy} L{x0:.1f} {y0:.1f} A64 64 0 0 0 {x1:.1f} {y1:.1f} Z" '
            f'fill="{TEAL}" fill-opacity="{0.32 * (1 - k / 10):.3f}"/>'
        )
    sats = []
    for r, dur, size, rev in [(96, 7, 4, False), (108, 11, 3, True), (120, 16, 2.5, False)]:
        frm, to = ("360", "0") if rev else ("0", "360")
        sats.append(
            f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{TEAL}" stroke-opacity=".12" stroke-dasharray="2 6"/>'
            f'<g><animateTransform attributeName="transform" type="rotate" from="{frm} {cx} {cy}" to="{to} {cx} {cy}" '
            f'dur="{dur}s" repeatCount="indefinite"/>'
            f'<circle cx="{cx + r}" cy="{cy}" r="{size}" fill="{TEAL}" filter="url(#glow)"/></g>'
        )
    rings = "".join(
        f'<circle cx="{cx}" cy="{cy}" r="74" fill="none" stroke="{TEAL}" stroke-opacity=".6">'
        f'<animate attributeName="r" values="74;140" dur="3s" begin="{b}s" repeatCount="indefinite"/>'
        f'<animate attributeName="stroke-opacity" values=".6;0" dur="3s" begin="{b}s" repeatCount="indefinite"/></circle>'
        for b in (0, 1.5)
    )
    return f"""
<g>
  {''.join(sats)}
  {rings}
  <circle cx="{cx}" cy="{cy}" r="78" fill="{PANEL}" stroke="{TEAL}" stroke-width="2"/>
  <g>
    <animateTransform attributeName="transform" type="rotate" from="0 {cx} {cy}" to="360 {cx} {cy}" dur="3.2s" repeatCount="indefinite"/>
    {''.join(wedges)}
    <line x1="{cx}" y1="{cy}" x2="{cx}" y2="{cy - 64}" stroke="{TEAL}" stroke-width="2"/>
  </g>
  <circle cx="{cx}" cy="{cy}" r="66" fill="none" stroke="{TEAL}" stroke-width="2" stroke-dasharray="6 10" stroke-opacity=".8">
    <animateTransform attributeName="transform" type="rotate" from="0 {cx} {cy}" to="360 {cx} {cy}" dur="14s" repeatCount="indefinite"/>
  </circle>
  <circle cx="{cx}" cy="{cy}" r="42" fill="{DARK}" fill-opacity=".85"/>
  <text x="{cx}" y="{cy + text_size * 0.35:.0f}" text-anchor="middle" font-family="{SANS}" font-size="{text_size}" font-weight="800" letter-spacing="3" fill="{TEAL}">{text}</text>
</g>"""


def window(w: float, h: float, title: str) -> str:
    """A dark rounded window with three dots and a centred title."""
    return f"""
<rect x="1" y="1" width="{w - 2}" height="{h - 2}" rx="14" fill="{DARK}" stroke="{TEAL}" stroke-opacity=".35"/>
<path d="M1 44 H{w - 1}" stroke="{TEAL}" stroke-opacity=".2"/>
<circle cx="26" cy="22" r="6" fill="{TEAL}" fill-opacity=".9"/>
<circle cx="46" cy="22" r="6" fill="{TEAL}" fill-opacity=".5"/>
<circle cx="66" cy="22" r="6" fill="{TEAL}" fill-opacity=".25"/>
<text x="{w / 2}" y="27" text-anchor="middle" font-family="{MONO}" font-size="13" fill="{WHITE}" fill-opacity=".55" style="white-space:pre">{esc(title)}</text>"""



def divider() -> str:
    w, h = 1000, 24
    body = f"""
<defs>
  <linearGradient id="fade" x1="0" x2="1">
    <stop offset="0" stop-color="{TEAL}" stop-opacity="0"/>
    <stop offset=".5" stop-color="{TEAL}" stop-opacity=".7"/>
    <stop offset="1" stop-color="{TEAL}" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="spark"><stop offset="0" stop-color="{WHITE}"/><stop offset=".4" stop-color="{TEAL}"/><stop offset="1" stop-color="{TEAL}" stop-opacity="0"/></radialGradient>
</defs>
<rect x="0" y="11" width="{w}" height="2" fill="url(#fade)"/>
<ellipse cx="0" cy="12" rx="60" ry="6" fill="url(#spark)">
  <animate attributeName="cx" values="-60;{w + 60}" dur="3.6s" repeatCount="indefinite"/>
</ellipse>
<ellipse cx="0" cy="12" rx="30" ry="4" fill="url(#spark)" opacity=".7">
  <animate attributeName="cx" values="{w + 60};-60" dur="5.2s" repeatCount="indefinite"/>
</ellipse>"""
    return svg(w, h, body)


def wave(amplitude: float, length: float, y: float, w: float, h: float) -> str:
    d = f"M 0 {y}"
    x = 0.0
    while x < w * 2 + length:
        d += f" q {length / 4} {-amplitude} {length / 2} 0 t {length / 2} 0"
        x += length
    return d + f" V {h} H 0 Z"


# ---------------------------------------------------------------- images


def hero(repo: Repo) -> str:
    w, h = 1280, 720
    cx, cy = 640, 520
    parts = [
        f"""
<defs>
  <radialGradient id="vignette" cx="50%" cy="45%" r="72%">
    <stop offset="60%" stop-color="{DARK}" stop-opacity="0"/>
    <stop offset="100%" stop-color="{DARK}" stop-opacity="1"/>
  </radialGradient>
  <linearGradient id="horizon" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{TEAL}" stop-opacity="0"/>
    <stop offset=".5" stop-color="{TEAL}" stop-opacity=".25"/>
    <stop offset="1" stop-color="{TEAL}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="scan" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{TEAL}" stop-opacity="0"/>
    <stop offset=".5" stop-color="{TEAL}" stop-opacity=".07"/>
    <stop offset="1" stop-color="{TEAL}" stop-opacity="0"/>
  </linearGradient>
  <filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="70"/></filter>
  {glow_filter("glow")}
  <linearGradient id="shine" gradientUnits="userSpaceOnUse" x1="-900" y1="0" x2="0" y2="0">
    <stop offset="0" stop-color="{TEAL}"/>
    <stop offset=".45" stop-color="{TEAL}"/>
    <stop offset=".5" stop-color="{WHITE}"/>
    <stop offset=".55" stop-color="{TEAL}"/>
    <stop offset="1" stop-color="{TEAL}"/>
    <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="2200 0" dur="5s" repeatCount="indefinite"/>
  </linearGradient>
</defs>
<rect width="{w}" height="{h}" fill="{DARK}"/>
{stars(w, 300, 110, 23)}
<g filter="url(#blur)" opacity=".55">
  <ellipse cx="300" cy="160" rx="260" ry="120" fill="{TEAL}" opacity=".35">
    <animate attributeName="cx" values="300;980;300" dur="18s" repeatCount="indefinite"/>
  </ellipse>
  <ellipse cx="980" cy="560" rx="300" ry="130" fill="{TEAL}" opacity=".22">
    <animate attributeName="cx" values="980;300;980" dur="22s" repeatCount="indefinite"/>
  </ellipse>
</g>
{neon_floor(w, h, 300)}
<rect x="0" y="286" width="{w}" height="28" fill="url(#horizon)"/>
<rect width="{w}" height="{h}" fill="url(#vignette)"/>
<rect x="0" y="-120" width="{w}" height="120" fill="url(#scan)">
  <animate attributeName="y" values="-120;{h}" dur="7s" repeatCount="indefinite"/>
</rect>
{logo(640 - 110, 46, 220)}
{glitch_title("DATADOE AI SKILLS", 210, 64)}
{taglines(264)}
{label(190, 318, "SKILLS BY TOPIC", "middle", 16)}
{label(1062, 318, "WHAT YOU GET", "middle", 16)}
"""
    ]

    cats = repo.by_category()
    top, step = 336, 38
    for i, (name, items) in enumerate(cats):
        y = top + i * step
        d = f"M 324 {y + 16} C 440 {y + 16}, 470 {cy}, {cx - 78} {cy}"
        parts.append(flow(f"in{i}", d, 2.6 + (i % 3) * 0.4, i * 0.37))
        parts.append(pill(56, y, 268, name, i * 0.27))
        parts.append(
            f'<text x="{56 + 268 - 16}" y="{y + 21.5}" text-anchor="end" font-family="{MONO}" font-size="17" '
            f'font-weight="700" fill="{TEAL}">{len(items)}</text>'
        )

    outs = OUTPUTS + ["Amazon change, after your OK"]
    otop, ostep = 350, 52
    for i, name in enumerate(outs):
        y = otop + i * ostep
        d = f"M {cx + 78} {cy} C 800 {cy}, 820 {y + 16}, 900 {y + 16}"
        parts.append(flow(f"out{i}", d, 2.4 + (i % 2) * 0.5, 0.5 + i * 0.45))
        parts.append(pill(900, y, 324, name, 0.4 + i * 0.3, strong=i == len(outs) - 1))

    parts.append(core(cx, cy, "SKILL", 22))
    frame = f'<defs><clipPath id="frame"><rect width="{w}" height="{h}" rx="16"/></clipPath></defs>'
    return svg(w, h, frame + '<g clip-path="url(#frame)">' + "".join(parts) + "</g>")


def stats(repo: Repo) -> str:
    """Odometer counters. The resting frame shows the real number, so a still render is right too."""
    counts = [
        (len(repo.skills), "skills"),
        (len(repo.by_category()), "topics"),
        (repo.count("access", "read"), "read-only"),
        (repo.count("access", "write"), "write, with your OK"),
        (repo.count("interface", "mcp", "both"), "run in any MCP client"),
        (sum(1 for s in repo.skills if s.get("youtube-video-embed-url")), "video walkthroughs"),
    ]
    w, h = 1000, 190
    card_w, gap = 150, 12
    dh, size = 58, 50
    digit_w = size * 0.6
    top = 62
    clips, cards = [], []
    for ci, (value, text) in enumerate(counts):
        x = 16 + ci * (card_w + gap)
        digits = str(value)
        nx = x + card_w / 2 - len(digits) * digit_w / 2
        cards.append(
            f'<rect x="{x:.1f}" y="46" width="{card_w}" height="128" rx="12" fill="{PANEL}" stroke="{TEAL}" stroke-opacity=".35"/>'
        )
        for di, ch in enumerate(digits):
            cid = f"o{ci}{di}"
            dx = nx + di * digit_w
            clips.append(f'<clipPath id="{cid}"><rect x="{dx:.1f}" y="{top}" width="{digit_w:.1f}" height="{dh}"/></clipPath>')
            steps = 10 + int(ch)
            col = "".join(
                f'<text x="{dx + digit_w / 2:.1f}" y="{top + 46 + n * dh}" text-anchor="middle" font-family="{MONO}" '
                f'font-size="{size}" font-weight="800" fill="{TEAL}">{n % 10}</text>'
                for n in range(steps + 1)
            )
            stop = -steps * dh
            cards.append(
                f'<g clip-path="url(#{cid})"><g transform="translate(0 {stop})">{col}'
                f'<animateTransform attributeName="transform" type="translate" values="0 0;0 {stop}" '
                f'keyTimes="0;1" calcMode="spline" keySplines=".15 .85 .25 1" '
                f'dur="2.6s" begin="{ci * 0.2 + di * 0.12:.2f}s" fill="freeze"/></g></g>'
            )
        bar = card_w - 36
        font = 15 if len(text) <= 16 else 13.5
        cards.append(
            f'<text x="{x + card_w / 2:.1f}" y="146" text-anchor="middle" font-family="{SANS}" font-size="{font}" '
            f'font-weight="600" fill="{WHITE}">{esc(text)}</text>'
            f'<rect x="{x + 18:.1f}" y="158" width="{bar}" height="3" rx="1.5" fill="{TEAL}" fill-opacity=".15"/>'
            f'<rect x="{x + 18:.1f}" y="158" width="{bar}" height="3" rx="1.5" fill="{TEAL}">'
            f'<animate attributeName="width" values="0;{bar}" keyTimes="0;1" calcMode="spline" keySplines=".15 .85 .25 1" '
            f'dur="2.6s" begin="{ci * 0.2:.2f}s" fill="freeze"/></rect>'
        )
    body = [
        f'<rect x="1" y="1" width="{w - 2}" height="{h - 2}" rx="16" fill="{DARK}" stroke="{TEAL}" stroke-opacity=".3"/>',
        label(24, 30, f"COUNTED FROM skills/  ·  {dt.date.today().isoformat()}"),
        label(w - 24, 30, "LIVE DATA FROM mcp.datadoe.com", "end"),
        "<defs>" + "".join(clips) + "</defs>",
        *cards,
    ]
    return svg(w, h, "\n".join(body))


def install() -> str:
    """A looping terminal and chat: install one skill, run it, hand the fix to a write skill with a dry run."""
    w, total = 1000, 23.0
    end = 0.94
    rows = [
        # (kind, text, result, start second)
        ("cmd", "npx skills@latest add Deltologic/datadoe-ai-skills --skill ppc-wasted-spend-watchdog", "", 0.4),
        ("ok", "skill installed in your agent", "", 3.4),
        ("you", "Find the wasted spend in my Sponsored Products, last 30 days.", "", 4.4),
        ("tool", "exports_create  amazon_ads_search_terms_by_campaign_by_date", "30 days", 7.0),
        ("row", "Dead search terms  ·  clicks, no orders      23 terms    spend $1,286.40", "", 8.2),
        ("row", "Bleeders  ·  over your break-even ACoS       17 terms    spend $642.75", "", 8.5),
        ("agent", "Add the 23 dead terms as negatives with ppc-negative-keyword-applier?", "", 9.6),
        ("you", "Yes, all 23, exact match.", "", 11.6),
        ("tool", "actions_start  AMAZON_ADS_TARGETS_ADD  dryRun: true", "VALIDATED  ·  nothing sent", 12.8),
        ("you", "Looks right. Apply.", "", 14.6),
        ("tool", "actions_start  AMAZON_ADS_TARGETS_ADD", "started", 15.8),
        ("tool", "actions_get", "COMPLETED  ·  23 negatives added", 17.0),
    ]

    def kt(t: float) -> str:
        return f"{t / total:.4f}"

    def show(start: float) -> str:
        return (
            f'<animate attributeName="opacity" values="0;0;1;1;0" '
            f'keyTimes="0;{kt(start)};{kt(start + 0.01)};{end};1" dur="{total}s" repeatCount="indefinite"/>'
        )

    def badge(y: float, text: str, start: float, ink: str = DARK, fill: str = TEAL) -> str:
        return (
            f'<g opacity="0">{show(start)}<rect x="22" y="{y - 17}" width="62" height="24" rx="12" fill="{fill}" '
            f'stroke="{TEAL}" stroke-opacity=".6"/><text x="53" y="{y}" text-anchor="middle" font-family="{MONO}" '
            f'font-size="13" font-weight="700" fill="{ink}">{text}</text></g>'
        )

    y0, dy = 86, 36
    h = y0 + len(rows) * dy + 30
    body = [window(w, h, "terminal  ·  then your AI agent"), "<defs>"]
    for i, (kind, text, _, start) in enumerate(rows):
        if kind in ("you", "cmd"):
            char = 9.1 if kind == "you" else 8.45
            width = len(text) * char + 8
            body.append(
                f'<clipPath id="c{i}"><rect x="96" y="{y0 + i * dy - 20}" height="28" width="0">'
                f'<animate attributeName="width" values="0;0;{width:.0f};{width:.0f};0" '
                f'keyTimes="0;{kt(start)};{kt(start + len(text) * 0.03)};{end};1" dur="{total}s" repeatCount="indefinite"/>'
                f"</rect></clipPath>"
            )
    body.append("</defs>")
    for i, (kind, text, result, start) in enumerate(rows):
        y = y0 + i * dy
        if kind == "cmd":
            body.append(
                badge(y, "$", start, TEAL, PANEL)
                + f'<text x="96" y="{y}" font-family="{MONO}" font-size="14" fill="{WHITE}" style="white-space:pre" '
                f'clip-path="url(#c{i})">{esc(text)}</text>'
            )
        elif kind == "ok":
            body.append(
                f'<g opacity="0">{show(start)}<text x="96" y="{y}" font-family="{MONO}" font-size="14" fill="{TEAL}">✓ {esc(text)}</text></g>'
            )
        elif kind == "you":
            body.append(
                badge(y, "you", start)
                + f'<text x="96" y="{y}" font-family="{SANS}" font-size="16" font-weight="600" fill="{WHITE}" '
                f'clip-path="url(#c{i})">{esc(text)}</text>'
            )
        elif kind == "agent":
            body.append(
                badge(y, "agent", start, TEAL, PANEL)
                + f'<g opacity="0">{show(start)}<text x="96" y="{y}" font-family="{SANS}" font-size="16" fill="{WHITE}" '
                f'fill-opacity=".9">{esc(text)}</text></g>'
            )
        elif kind == "tool":
            body.append(
                f'<g opacity="0">{show(start)}'
                f'<circle cx="53" cy="{y - 5}" r="5" fill="none" stroke="{TEAL}" stroke-width="2"/>'
                f'<text x="96" y="{y}" font-family="{MONO}" font-size="14" fill="{TEAL}" style="white-space:pre">{esc(text)}</text></g>'
                f'<g opacity="0">{show(start + 0.6)}'
                f'<circle cx="53" cy="{y - 5}" r="5" fill="{TEAL}"/>'
                f'<text x="{w - 32}" y="{y}" text-anchor="end" font-family="{MONO}" font-size="14" fill="{WHITE}" '
                f'fill-opacity=".75">✓ {esc(result)}</text></g>'
            )
        else:
            body.append(
                f'<g opacity="0">{show(start)}<rect x="96" y="{y - 20}" width="{w - 128}" height="28" rx="6" '
                f'fill="{PANEL}" stroke="{TEAL}" stroke-opacity=".2"/>'
                f'<text x="112" y="{y}" font-family="{MONO}" font-size="14" fill="{WHITE}" style="white-space:pre">{esc(text)}</text></g>'
            )
    return svg(w, h, "\n".join(body))


def catalog(repo: Repo) -> str:
    """Every skill as a chip in its topic row; filled chips write to Amazon after your OK.

    Chips fade in once from t=0; their resting state is visible, so a still render shows them all.
    """
    w = 1000
    name_w, x_chips, right = 196, 216, w - 20
    chip_h, row_gap, chip_gap, char = 32, 14, 8, 8.7
    cats = repo.by_category()
    body_rows, y = [], 70
    n = 0
    for cat, items in cats:
        lines: list[list[tuple[float, float, dict[str, str]]]] = [[]]
        x = x_chips
        for s in items:
            cw = len(s["title"]) * char + 36
            if x + cw > right and lines[-1]:
                lines.append([])
                x = x_chips
            lines[-1].append((x, cw, s))
            x += cw + chip_gap
        row_h = len(lines) * chip_h + (len(lines) - 1) * 8
        body_rows.append(
            f'<text x="20" y="{y + 22}" font-family="{SANS}" font-size="17" font-weight="700" fill="{WHITE}">{esc(cat)}</text>'
            f'<text x="{name_w}" y="{y + 22}" text-anchor="end" font-family="{MONO}" font-size="17" font-weight="700" fill="{TEAL}">{len(items)}</text>'
        )
        for li, line in enumerate(lines):
            cy = y + li * (chip_h + 8)
            for x, cw, s in line:
                write = s.get("access") == "write"
                fill, ink = (TEAL, DARK) if write else (PANEL, WHITE)
                delay = 0.1 + n * 0.05
                n += 1
                mark = "✎" if write else "●"
                body_rows.append(
                    f'<g><animate attributeName="opacity" values="0;0;1" keyTimes="0;{delay / (delay + .5):.3f};1" '
                    f'dur="{delay + .5:.2f}s" fill="freeze"/>'
                    f'<rect x="{x:.1f}" y="{cy}" width="{cw:.1f}" height="{chip_h}" rx="15" fill="{fill}" stroke="{TEAL}" stroke-opacity=".45"/>'
                    f'<text x="{x + 13:.1f}" y="{cy + 21}" font-family="{SANS}" font-size="13" fill="{DARK if write else TEAL}">{mark}</text>'
                    f'<text x="{x + 28:.1f}" y="{cy + 21.5}" font-family="{SANS}" font-size="15.5" font-weight="{700 if write else 500}" '
                    f'fill="{ink}">{esc(s["title"])}</text></g>'
                )
        y += row_h + row_gap
        body_rows.append(f'<line x1="20" x2="{right}" y1="{y - row_gap / 2}" y2="{y - row_gap / 2}" stroke="{TEAL}" stroke-opacity=".1"/>')
    h = y + 40
    legend_y = h - 20
    body = [
        f'<rect x="1" y="1" width="{w - 2}" height="{h - 2}" rx="16" fill="{DARK}" stroke="{TEAL}" stroke-opacity=".3"/>',
        label(20, 32, f"{len(repo.skills)} SKILLS IN {len(cats)} TOPICS"),
        *body_rows,
        f'<text x="20" y="{legend_y}" font-family="{SANS}" font-size="15" fill="{WHITE}" fill-opacity=".75" style="white-space:pre">'
        f'<tspan fill="{TEAL}">●</tspan> reads your data only     <tspan fill="{TEAL}">✎</tspan> write skill: changes Amazon after a dry run '
        f'and your OK</text>',
    ]
    return svg(w, h, "\n".join(body))


def write_path() -> str:
    """The path every write skill takes, as five lit stations with a packet running through them."""
    w, h, total = 1000, 280, 7.0
    steps = [
        ("Read", "exports_create", "your live data"),
        ("Find", "skill rules", "what to change"),
        ("Dry run", "dryRun: true", "nothing sent"),
        ("Your OK", "in the chat", "required"),
        ("Apply", "actions_start", "status checked"),
    ]
    xs = [100 + i * 200 for i in range(len(steps))]
    cy = 104
    body = [
        f"<defs>{glow_filter('glow')}</defs>",
        f'<rect x="1" y="1" width="{w - 2}" height="{h - 2}" rx="16" fill="{DARK}" stroke="{TEAL}" stroke-opacity=".3"/>',
        label(24, 32, "HOW A WRITE SKILL CHANGES YOUR ACCOUNT"),
        f'<line x1="{xs[0]}" y1="{cy}" x2="{xs[-1]}" y2="{cy}" stroke="{TEAL}" stroke-opacity=".25" stroke-width="2"/>',
        f'<line x1="{xs[0]}" y1="{cy}" x2="{xs[-1]}" y2="{cy}" stroke="{TEAL}" stroke-opacity=".6" stroke-width="2" stroke-dasharray="3 14">'
        f'<animate attributeName="stroke-dashoffset" from="34" to="0" dur="1.2s" repeatCount="indefinite"/></line>',
        f'<circle cx="{xs[0]}" cy="{cy}" r="6" fill="{WHITE}" filter="url(#glow)">'
        f'<animate attributeName="cx" values="{xs[0]};{xs[-1]};{xs[-1]}" keyTimes="0;.8;1" dur="{total}s" repeatCount="indefinite"/>'
        f'<animate attributeName="opacity" values="1;1;0" keyTimes="0;.82;1" dur="{total}s" repeatCount="indefinite"/></circle>',
    ]
    for i, (title, code, note) in enumerate(steps):
        x = xs[i]
        t = i / (len(steps) - 1) * 0.8
        lit = (
            f'<animate attributeName="fill-opacity" values=".08;.08;.9;.25;.08" '
            f'keyTimes="0;{max(t - 0.001, 0):.3f};{t + 0.001:.3f};{min(t + 0.12, 0.99):.3f};1" dur="{total}s" repeatCount="indefinite"/>'
        )
        gate = i == 3
        body.append(
            f'<circle cx="{x}" cy="{cy}" r="34" fill="{TEAL}" fill-opacity=".08">{lit}</circle>'
            f'<circle cx="{x}" cy="{cy}" r="34" fill="none" stroke="{TEAL}" stroke-width="{3 if gate else 2}"/>'
            f'<text x="{x}" y="{cy + 8}" text-anchor="middle" font-family="{MONO}" font-size="22" font-weight="800" fill="{WHITE}">0{i + 1}</text>'
            f'<text x="{x}" y="{cy + 68}" text-anchor="middle" font-family="{SANS}" font-size="20" font-weight="700" fill="{TEAL if gate else WHITE}">{title}</text>'
            f'<text x="{x}" y="{cy + 96}" text-anchor="middle" font-family="{MONO}" font-size="16" fill="{TEAL}" style="white-space:pre">{esc(code)}</text>'
            f'<text x="{x}" y="{cy + 124}" text-anchor="middle" font-family="{SANS}" font-size="17" fill="{WHITE}" fill-opacity=".85">{note}</text>'
        )
    return svg(w, h, "\n".join(body))


def footer() -> str:
    w, h = 1280, 250
    body = []
    for amp, length, y, opacity, dur in [(14, 320, 70, 0.18, 11), (18, 400, 90, 0.32, 8), (12, 256, 112, 1.0, 6)]:
        fill = TEAL if opacity < 1 else DARK
        body.append(
            f'<path d="{wave(amp, length, y, w, h)}" fill="{fill}" fill-opacity="{opacity}">'
            f'<animateTransform attributeName="transform" type="translate" from="0 0" to="{-length} 0" '
            f'dur="{dur}s" repeatCount="indefinite"/></path>'
        )
    body.append(logo(640 - 80, 140, 160))
    body.append(label(640, 224, "AI SKILLS FOR AMAZON SELLERS AND VENDORS", "middle", 14))
    return svg(w, h, "\n".join(body))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--repo", type=Path, default=HERE.parent.parent, help="checkout with skills/")
    args = parser.parse_args()
    repo = Repo(args.repo.expanduser().resolve())
    outputs = {
        "hero.svg": hero(repo),
        "stats.svg": stats(repo),
        "install.svg": install(),
        "catalog.svg": catalog(repo),
        "write-path.svg": write_path(),
        "divider.svg": divider(),
        "footer.svg": footer(),
    }
    for name, content in outputs.items():
        (HERE / name).write_text(content)
        print(f"wrote {name} ({len(content.encode()) // 1024} KB)")


if __name__ == "__main__":
    main()
