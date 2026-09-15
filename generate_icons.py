"""Generate simple toolbar icons for the Chrome extension."""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent / "icons"
ROOT.mkdir(exist_ok=True)


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    radius = max(3, size // 5)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=(8, 102, 255, 255))

    if size >= 32:
        pad = size // 6
        grid = (pad, pad, size - pad, int(size * 0.42))
        draw.rounded_rectangle(grid, radius=max(2, size // 16), outline=(255, 255, 255, 220), width=max(1, size // 32))
        mid_x = (grid[0] + grid[2]) // 2
        mid_y = (grid[1] + grid[3]) // 2
        draw.line((mid_x, grid[1], mid_x, grid[3]), fill=(255, 255, 255, 180), width=max(1, size // 48))
        draw.line((grid[0], mid_y, grid[2], mid_y), fill=(255, 255, 255, 180), width=max(1, size // 48))

    cx, cy = size * 0.54, size * (0.62 if size >= 32 else 0.5)
    s = size * (0.22 if size >= 32 else 0.28)
    play = [
        (cx - s * 0.55, cy - s),
        (cx - s * 0.55, cy + s),
        (cx + s * 0.85, cy),
    ]
    draw.polygon(play, fill=(255, 255, 255, 255))
    return img


for size in (16, 48, 128):
    draw_icon(size).save(ROOT / f"icon{size}.png")
    print("wrote", ROOT / f"icon{size}.png")
