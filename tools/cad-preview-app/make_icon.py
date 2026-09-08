from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw


def main() -> int:
    app_root = Path(__file__).resolve().parent
    assets = app_root / "assets"
    iconset = assets / "AppIcon.iconset"
    if iconset.exists():
        shutil.rmtree(iconset)
    iconset.mkdir(parents=True)

    master = Image.new("RGBA", (1024, 1024), (16, 23, 29, 255))
    draw = ImageDraw.Draw(master)
    draw.rounded_rectangle((72, 72, 952, 952), radius=190, fill=(22, 35, 44, 255), outline=(0, 224, 231, 255), width=34)
    draw.line((250, 290, 425, 742, 602, 290), fill=(0, 224, 231, 255), width=66, joint="curve")
    draw.line((520, 742, 700, 290, 850, 742), fill=(255, 214, 10, 255), width=66, joint="curve")
    draw.line((600, 555, 790, 555), fill=(255, 214, 10, 255), width=54)

    sizes = ((16, "icon_16x16.png"), (32, "icon_16x16@2x.png"), (32, "icon_32x32.png"),
             (64, "icon_32x32@2x.png"), (128, "icon_128x128.png"), (256, "icon_128x128@2x.png"),
             (256, "icon_256x256.png"), (512, "icon_256x256@2x.png"), (512, "icon_512x512.png"),
             (1024, "icon_512x512@2x.png"))
    for size, name in sizes:
        master.resize((size, size), Image.Resampling.LANCZOS).save(iconset / name)
    subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", str(assets / "AppIcon.icns")], check=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
