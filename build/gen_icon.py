# -*- coding: utf-8 -*-
"""生成 Samaritan 应用图标：深色圆角方形底 + 3x3 三色簇（呼应加载动画）"""
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), "icon.ico")

# 品牌色
AMBER = (240, 130, 0)     # 琥珀橙 #f08200
GREEN = (0, 168, 84)      # 绿 #00a854
CORAL = (240, 19, 13)     # 珊瑚红 #f0130d
BG = (22, 22, 27)         # 深色底 #16161b

SIZE = 1024
R = 232                    # 背景圆角半径
img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# 圆角方形背景
d.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=R, fill=BG)

# 3x3 网格
CELL = 184
GAP = 44
GRID = 3 * CELL + 2 * GAP          # 640
OX = (SIZE - GRID) // 2            # 192
OY = (SIZE - GRID) // 2
CR = 40                            # 格子圆角

cols = [AMBER, GREEN, CORAL]       # 三列三色
for r in range(3):
    for c in range(3):
        x0 = OX + c * (CELL + GAP)
        y0 = OY + r * (CELL + GAP)
        d.rounded_rectangle([x0, y0, x0 + CELL, y0 + CELL], radius=CR, fill=cols[c])

# 中心格加白色高光描边，突出"轴心"意象
cx = OX + 1 * (CELL + GAP)
cy = OY + 1 * (CELL + GAP)
d.rounded_rectangle([cx - 6, cy - 6, cx + CELL + 6, cy + CELL + 6],
                    radius=CR + 6, outline=(255, 255, 255, 200), width=10)

img.save(OUT, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("icon written:", OUT, os.path.getsize(OUT), "bytes")

# 托盘图标（小尺寸）
tray = img.resize((32, 32), Image.LANCZOS)
tray.save(os.path.join(os.path.dirname(__file__), "tray.png"))
print("tray written")
