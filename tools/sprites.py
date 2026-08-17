#!/usr/bin/env python3
"""
sprites.py — deja listos para el juego los sprites que salen de ChatGPT.

Hace lo que hasta ahora se hacía a mano, uno por uno:
  1. quita el fondo liso,
  2. recorta al contenido (esquinas transparentes, como el resto del arte),
  3. escala a una altura fija para que todos los cuadros midan igual,
  4. los nombra con la convención del proyecto (base0.png, base01.png…).

Está en Python y no en Node como los otros scripts de tools/ porque Pillow ya
está instalado en la máquina y así no hay que sumar dependencias al repo.

USO
  # una imagen suelta
  python tools/sprites.py img/crudo/cangrejo.png --nombre cangrejo_walk --alto 90

  # una carpeta entera (ordena por nombre y numera)
  python tools/sprites.py img/crudo/ --nombre cangrejo_walk --alto 90

  # una hoja con varios cuadros en grilla
  python tools/sprites.py hoja.png --grilla 4x1 --nombre cangrejo_walk --alto 90

  # ver qué haría, sin escribir nada
  python tools/sprites.py img/crudo/ --nombre x --previo

OPCIONES QUE IMPORTAN
  --tol N     Cuánto se parece un píxel al fondo para borrarlo (default 12).
              Subila si queda fondo; bajala si se come el sprite.
  --alto N    Altura final en px. Sin esto, no escala.
  --salida    Carpeta destino (default img/level5/).
"""

import argparse
import os
import sys
from collections import Counter

# La consola de Windows usa cp1252 y revienta al imprimir acentos o simbolos.
# Como el script lo van a correr desde ahi, se fuerza UTF-8 con reemplazo.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

try:
    from PIL import Image
except ImportError:
    sys.exit("Falta Pillow.  pip install pillow")


# ── Fondo ────────────────────────────────────────────────────────────────────

def _dominant_border_colors(img, max_colors=3):
    """
    Los colores del fondo se deducen del borde de la imagen: es lo único que
    con seguridad NO es el personaje. Se devuelven los más repetidos (varios,
    porque ChatGPT a veces entrega un damero o un degradé suave).
    """
    px = img.load()
    w, h = img.size
    border = []
    for x in range(w):
        border.append(px[x, 0][:3])
        border.append(px[x, h - 1][:3])
    for y in range(h):
        border.append(px[0, y][:3])
        border.append(px[w - 1, y][:3])

    common = Counter(border).most_common(max_colors)
    # Sólo los que ocupan una porción real del borde: si un color aparece
    # cuatro veces es parte del dibujo asomándose, no el fondo.
    threshold = len(border) * 0.05
    return [color for color, count in common if count >= threshold] or [common[0][0]]


def _close_to_any(color, palette, tol):
    for ref in palette:
        if (abs(color[0] - ref[0]) + abs(color[1] - ref[1]) + abs(color[2] - ref[2])) <= tol * 3:
            return True
    return False


def remove_background(img, tol=32):
    """
    Borra el fondo por inundación DESDE LOS BORDES, no por color en toda la
    imagen. La diferencia importa: si el bicho tiene blanco en los ojos o en un
    brillo, un borrado por color se lo comería; inundando desde afuera, ese
    blanco está rodeado de dibujo y no se toca nunca.
    """
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()
    palette = _dominant_border_colors(img)

    visited = bytearray(w * h)
    stack = []

    for x in range(w):
        stack.append((x, 0))
        stack.append((x, h - 1))
    for y in range(h):
        stack.append((0, y))
        stack.append((w - 1, y))

    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        i = y * w + x
        if visited[i]:
            continue
        visited[i] = 1

        r, g, b, a = px[x, y]
        if a == 0:
            # Ya era transparente: sigue siendo fondo y se propaga.
            stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
            continue
        if not _close_to_any((r, g, b), palette, tol):
            continue

        px[x, y] = (r, g, b, 0)
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    return img


def despeckle_edges(img):
    """
    Los bordes antialiaseados dejan un halo del color del fondo. Se baja el
    alfa de los píxeles casi transparentes para que el contorno no quede con
    una aureola blanca sobre el agua oscura del lago.
    """
    img = img.convert("RGBA")
    alpha = img.getchannel("A").point(lambda a: 0 if a < 40 else (255 if a > 215 else a))
    img.putalpha(alpha)
    return img


# ── Recorte y escala ─────────────────────────────────────────────────────────

def trim(img, padding=0):
    """Recorta al contenido. Así el sprite queda centrado en su propia caja."""
    box = img.getbbox()
    if not box:
        return img
    if padding:
        left, top, right, bottom = box
        box = (max(0, left - padding), max(0, top - padding),
               min(img.width, right + padding), min(img.height, bottom + padding))
    return img.crop(box)


def scale_to_height(img, height):
    if not height or img.height == height:
        return img
    width = max(1, round(img.width * height / img.height))
    return img.resize((width, height), Image.LANCZOS)


# ── Hojas de sprites ─────────────────────────────────────────────────────────

def split_sheet(img, cols, rows):
    """ChatGPT a veces entrega los cuadros en grilla dentro de una sola imagen."""
    fw, fh = img.width // cols, img.height // rows
    return [
        img.crop((c * fw, r * fh, (c + 1) * fw, (r + 1) * fh))
        for r in range(rows)
        for c in range(cols)
    ]


# ── Nombres ──────────────────────────────────────────────────────────────────

def frame_name(base, index):
    """
    Convención del proyecto, tal como está en img/level3/:
    el primero sin cero (walk0) y los siguientes con cero (walk01, walk02…).
    """
    return f"{base}{index}.png" if index == 0 else f"{base}0{index}.png"


# ── Programa ─────────────────────────────────────────────────────────────────

def gather_inputs(path, grid):
    if os.path.isdir(path):
        names = sorted(
            f for f in os.listdir(path)
            if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))
        )
        return [Image.open(os.path.join(path, n)) for n in names]

    img = Image.open(path)
    if grid:
        cols, rows = (int(v) for v in grid.lower().split("x"))
        return split_sheet(img, cols, rows)
    return [img]


def main():
    ap = argparse.ArgumentParser(description="Deja listos los sprites de ChatGPT.")
    ap.add_argument("entrada", help="Imagen, hoja o carpeta")
    ap.add_argument("--nombre", required=True, help="Base del nombre (ej: cangrejo_walk)")
    ap.add_argument("--salida", default="img/level5", help="Carpeta destino")
    ap.add_argument("--alto", type=int, default=0, help="Altura final en px")
    ap.add_argument("--tol", type=int, default=12, help="Tolerancia del fondo (default 12)")
    ap.add_argument("--padding", type=int, default=0, help="Margen al recortar")
    ap.add_argument("--grilla", help="Partir una hoja, ej: 4x1")
    ap.add_argument("--sin-fondo", action="store_true",
                    help="La imagen ya viene sin fondo: sólo recortar y escalar")
    ap.add_argument("--previo", action="store_true", help="No escribe nada, sólo informa")
    args = ap.parse_args()

    frames = gather_inputs(args.entrada, args.grilla)
    if not frames:
        sys.exit(f"No encontré imágenes en {args.entrada}")

    if not args.previo:
        os.makedirs(args.salida, exist_ok=True)

    for i, frame in enumerate(frames):
        img = frame.convert("RGBA")
        antes = img.size

        if not args.sin_fondo:
            img = despeckle_edges(remove_background(img, args.tol))
        img = trim(img, args.padding)
        img = scale_to_height(img, args.alto)

        name = frame_name(args.nombre, i)
        destino = os.path.join(args.salida, name)

        if args.previo:
            print(f"  {antes[0]}x{antes[1]}  ->  {img.size[0]}x{img.size[1]}   {destino}")
            continue

        img.save(destino, optimize=True)
        kb = os.path.getsize(destino) / 1024
        print(f"  ok  {name:32} {img.size[0]}x{img.size[1]}  {kb:.1f} KB")

    if args.previo:
        print("\n(previo: no se escribió nada)")
    else:
        print(f"\n{len(frames)} sprites en {args.salida}/")
        print("Revisá que no haya quedado halo. Si quedó fondo, subí --tol; "
              "si se comió parte del bicho, bajala.")


if __name__ == "__main__":
    main()
