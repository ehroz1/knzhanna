"""Generate the styled QR codes for Zhanna's card.

    pip install segno pillow
    python qr/make_qr.py [url]

Writes qr-light.svg/png, qr-dark.svg/png and qr-card.png next to this file.
"""

import base64
import io
import math
import sys
from pathlib import Path

import segno
from PIL import Image, ImageDraw, ImageFont

URL = sys.argv[1] if len(sys.argv) > 1 else "https://knzhanna.picta.cc"
LABEL = URL.split("://", 1)[-1].rstrip("/")

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PHOTO = ROOT / "assets" / "photo.jpg"

DARK = "#1C1D20"
BLUE = "#455CE9"
WHITE = "#FFFFFF"
GRAY = "#999D9E"

QUIET = 4          # quiet zone, modules
DOT = 0.43         # dot radius, modules
LOGO = 0.25        # logo diameter as a share of the symbol width
FONT_DIR = Path("/usr/share/fonts/opentype/inter")


def avatar() -> Image.Image:
    """Square face crop from the hero photo."""
    im = Image.open(PHOTO).convert("RGB")
    w, _ = im.size
    k = w / 1333  # crop box was picked on the 1333px original
    box = tuple(round(v * k) for v in (350, 430, 830, 910))
    return im.crop(box)


def build():
    qr = segno.make(URL, error="h", micro=False)
    m = [list(row) for row in qr.matrix]
    n = len(m)
    eyes = [(0, 0), (n - 7, 0), (0, n - 7)]
    c = n / 2
    clear = n * LOGO / 2 + 0.7

    def in_eye(x, y):
        return any(ex <= x < ex + 7 and ey <= y < ey + 7 for ex, ey in eyes)

    dots = [
        (x, y)
        for y in range(n)
        for x in range(n)
        if m[y][x] and not in_eye(x, y) and math.hypot(x + 0.5 - c, y + 0.5 - c) > clear
    ]
    return n, eyes, dots


def svg(n, eyes, dots, fg, bg, eye, face_b64):
    size = n + 2 * QUIET
    o = QUIET
    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="1024" height="1024">',
        f'<rect width="{size}" height="{size}" fill="{bg}"/>',
        f'<g fill="{fg}">',
    ]
    out += [f'<circle cx="{x + o + 0.5}" cy="{y + o + 0.5}" r="{DOT}"/>' for x, y in dots]
    out.append("</g>")
    for ex, ey in eyes:
        x, y = ex + o, ey + o
        out.append(f'<rect x="{x}" y="{y}" width="7" height="7" rx="2.3" fill="{fg}"/>')
        out.append(f'<rect x="{x + 1}" y="{y + 1}" width="5" height="5" rx="1.5" fill="{bg}"/>')
        out.append(f'<rect x="{x + 2}" y="{y + 2}" width="3" height="3" rx="0.95" fill="{eye}"/>')
    r = n * LOGO / 2
    cx = cy = size / 2
    out += [
        f'<circle cx="{cx}" cy="{cy}" r="{r + 0.35}" fill="{bg}"/>',
        f'<clipPath id="face"><circle cx="{cx}" cy="{cy}" r="{r}"/></clipPath>',
        f'<image href="data:image/jpeg;base64,{face_b64}" x="{cx - r}" y="{cy - r}" '
        f'width="{2 * r}" height="{2 * r}" clip-path="url(#face)" preserveAspectRatio="xMidYMid slice"/>',
        "</svg>",
    ]
    return "\n".join(out)


def png(n, eyes, dots, fg, bg, eye, face, px=2048):
    ss = 4  # supersample for smooth edges
    size = n + 2 * QUIET
    u = px * ss / size
    img = Image.new("RGB", (px * ss, px * ss), bg)
    d = ImageDraw.Draw(img)
    o = QUIET

    for x, y in dots:
        cx, cy = (x + o + 0.5) * u, (y + o + 0.5) * u
        d.ellipse((cx - DOT * u, cy - DOT * u, cx + DOT * u, cy + DOT * u), fill=fg)

    for ex, ey in eyes:
        x, y = (ex + o) * u, (ey + o) * u
        d.rounded_rectangle((x, y, x + 7 * u, y + 7 * u), radius=2.3 * u, fill=fg)
        d.rounded_rectangle((x + u, y + u, x + 6 * u, y + 6 * u), radius=1.5 * u, fill=bg)
        d.rounded_rectangle((x + 2 * u, y + 2 * u, x + 5 * u, y + 5 * u), radius=0.95 * u, fill=eye)

    r = n * LOGO / 2 * u
    c = size / 2 * u
    ring = 0.35 * u
    d.ellipse((c - r - ring, c - r - ring, c + r + ring, c + r + ring), fill=bg)
    side = round(2 * r)
    f = face.resize((side, side), Image.LANCZOS)
    mask = Image.new("L", (side, side), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, side - 1, side - 1), fill=255)
    img.paste(f, (round(c - r), round(c - r)), mask)

    return img.resize((px, px), Image.LANCZOS)


def font(name, size):
    return ImageFont.truetype(str(FONT_DIR / name), size)


def card(qr_img: Image.Image) -> Image.Image:
    """1080×1350 card in the site's style: dark, big name, QR tile + blue circle."""
    W, H, P = 1080, 1350, 88
    ss = 2
    img = Image.new("RGB", (W * ss, H * ss), DARK)
    d = ImageDraw.Draw(img)
    s = lambda v: round(v * ss)  # noqa: E731

    muted = (255, 255, 255, 115)
    small = font("Inter-Medium.otf", s(20))
    d.text((s(P), s(P)), "BUSINESS CARD", font=small, fill="#8E8F92")
    d.text((s(W - P), s(P)), "© 2026", font=small, fill="#8E8F92", anchor="ra")

    big = font("InterDisplay-Regular.otf", s(112))
    d.text((s(P - 6), s(P + 70)), "Zhanna\nKinzhalinova", font=big, fill=WHITE, spacing=s(4))
    role = font("InterDisplay-Regular.otf", s(38))
    d.text((s(P), s(P + 345)), "Editor at weproject.media", font=role, fill="#B9BABC")

    # stripe
    d.rectangle((s(P), s(800), s(W - P), s(801)), fill="#3A3B3F")

    # QR tile
    tile = 540
    tx, ty = P, 800 - tile // 2 + 40
    d.rounded_rectangle((s(tx), s(ty), s(tx + tile), s(ty + tile)), radius=s(44), fill=WHITE)
    q = qr_img.resize((s(tile - 36), s(tile - 36)), Image.LANCZOS)
    img.paste(q, (s(tx + 18), s(ty + 18)))

    # blue circle
    rc = 118
    cx, cy = W - P - rc - 10, 800
    d.ellipse((s(cx - rc), s(cy - rc), s(cx + rc), s(cy + rc)), fill=BLUE)
    btn = font("InterDisplay-Regular.otf", s(30))
    d.text((s(cx), s(cy)), "Scan me", font=btn, fill=WHITE, anchor="mm")

    # footer line
    url = font("InterDisplay-Regular.otf", s(34))
    d.text((s(W - P), s(H - P)), LABEL + "  ↗", font=url, fill=WHITE, anchor="rs")
    d.text((s(W - P), s(H - P - 58)), "@knzhanna", font=url, fill="#8E8F92", anchor="rs")

    del muted
    return img.resize((W, H), Image.LANCZOS)


def main():
    n, eyes, dots = build()
    face = avatar()
    buf = io.BytesIO()
    face.resize((360, 360), Image.LANCZOS).save(buf, "JPEG", quality=88)
    face_b64 = base64.b64encode(buf.getvalue()).decode()

    variants = {
        "light": dict(fg=DARK, bg=WHITE, eye=BLUE),
        "dark": dict(fg=WHITE, bg=DARK, eye=WHITE),
    }
    for name, colors in variants.items():
        (HERE / f"qr-{name}.svg").write_text(svg(n, eyes, dots, face_b64=face_b64, **colors))
        png(n, eyes, dots, face=face, **colors).save(HERE / f"qr-{name}.png", optimize=True)

    light = png(n, eyes, dots, face=face, fg=DARK, bg=WHITE, eye=BLUE, px=1600)
    # The card tile already has padding, so trim the quiet zone a bit.
    q = QUIET - 1.5
    crop = round(light.width * q / (n + 2 * QUIET))
    light = light.crop((crop, crop, light.width - crop, light.height - crop))
    card(light).save(HERE / "qr-card.png", optimize=True)
    print(f"{URL}: version {segno.make(URL, error='h', micro=False).designator}, {n}x{n} modules")


if __name__ == "__main__":
    main()
