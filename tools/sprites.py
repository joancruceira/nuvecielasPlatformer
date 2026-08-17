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

  # una hoja con varios cuadros — RECOMENDADO: detecta los cuadros solo,
  # aunque esten desparejos o descentrados (que es lo que suele pasar)
  python tools/sprites.py hoja.png --auto --nombre cangrejo_walk --alto 90

  # una hoja que si respeta una grilla pareja
  python tools/sprites.py hoja.png --grilla 4x1 --nombre cangrejo_walk --alto 90

  # ver qué haría, sin escribir nada
  python tools/sprites.py img/crudo/ --nombre x --previo

OPCIONES QUE IMPORTAN
  --tol N     Cuánto se parece un píxel al fondo para borrarlo (default 12).
              Subila si queda fondo; bajala si se come el sprite.
  --alto N    Altura final en px. Sin esto, no escala.
  --salida    Carpeta destino (default img/level5/).
  --union N   Solo con --auto: cuanto se engordan las manchas antes de agrupar,
              en % del ancho (default 0.8). Subila si un bicho se parte en dos;
              bajala si dos cuadros vecinos quedan pegados.
  --esperados N  Solo con --auto: avisa si no encontro esa cantidad de cuadros.

CUANDO CHATGPT ENTREGA UNA LAMINA DE PRESENTACION
  (fondo oscuro, titulos, carteles de tamano y stats por cada bicho)
  --sin-etiquetas  Descarta el cartel que quedo ARRIBA del sprite.
  --sin-motas      Descarta lo que quedo AL COSTADO y las burbujas sueltas.
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


def drop_label_bands(img, keep_ratio=0.18):
    """
    Saca los carteles que vienen pegados arriba del sprite.

    Hace falta cuando ChatGPT entrega LÁMINAS DE PRESENTACIÓN en vez de hojas
    limpias: cada bicho viene con su titulito ("2. CORAL TUBULAR") o su número,
    y al detectar los cuadros el cartel entra adentro del recorte.

    Cómo: se parte el sprite en franjas horizontales separadas por filas vacías
    y se descartan las que tienen poca tinta. El bicho es la franja pesada; un
    renglón de texto es liviano. Se conservan las franjas que llegan al 18% de
    la principal, para no perder una parte legítima que esté despegada.
    """
    alpha = img.getchannel("A")
    w, h = alpha.size
    px = alpha.load()
    rows = [sum(1 for x in range(w) if px[x, y] > 24) for y in range(h)]

    bands = []
    start = None
    for y, v in enumerate(rows):
        if v > 0 and start is None:
            start = y
        elif v == 0 and start is not None:
            bands.append((start, y - 1))
            start = None
    if start is not None:
        bands.append((start, h - 1))

    if len(bands) <= 1:
        return img

    mass = [sum(rows[a:b + 1]) for a, b in bands]
    biggest = max(mass)
    keep = [b for b, m in zip(bands, mass) if m >= biggest * keep_ratio]
    return img.crop((0, min(b[0] for b in keep), w, max(b[1] for b in keep) + 1))


def drop_small_blobs(img, min_ratio=0.03):
    """
    Borra las manchitas sueltas que no son parte del bicho.

    Es el complemento de drop_label_bands: sirve cuando el cartel no está
    ARRIBA sino AL COSTADO ("1.", "3. CORAL ABANICO"), y entonces comparte
    franja horizontal con el dibujo y no se puede cortar por filas.

    Se queda con la mancha más grande y con cualquier otra que llegue al 3% de
    su tamaño. Un renglón de texto no llega; una pata o una base de roca sí.
    Ojo: también se lleva las burbujitas decorativas sueltas.
    """
    alpha = img.getchannel("A")
    w, h = alpha.size
    px = alpha.load()

    labels = [0] * (w * h)
    blobs = []
    for start in range(w * h):
        if labels[start] or px[start % w, start // w] <= 24:
            continue
        tag = len(blobs) + 1
        stack = [start]
        labels[start] = tag
        pixels = []
        while stack:
            i = stack.pop()
            pixels.append(i)
            x, y = i % w, i // w
            for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
                if 0 <= nx < w and 0 <= ny < h:
                    j = ny * w + nx
                    if not labels[j] and px[nx, ny] > 24:
                        labels[j] = tag
                        stack.append(j)
        blobs.append(pixels)

    if len(blobs) <= 1:
        return img

    biggest = max(len(b) for b in blobs)
    salida = img.copy()
    out = salida.load()
    for b in blobs:
        if len(b) < biggest * min_ratio:
            for i in b:
                x, y = i % w, i // w
                out[x, y] = (0, 0, 0, 0)
    return salida


def trim_faint_columns(img, umbral=0.25):
    """
    Recorta por los costados las columnas de poca tinta.

    Es el remedio para el problema que ya apareció cuatro veces: el efecto
    dibujado DENTRO del sprite —estela, líneas de velocidad, proyectil— lo hace
    mucho más ancho que el resto de sus cuadros, y como el motor mete todo en
    una caja fija, el bicho se achica justo en el cuadro más visible.

    El cuerpo es denso y las líneas de velocidad son finas, así que alcanza con
    mirar cuánta tinta tiene cada columna: se descartan las de los extremos que
    no llegan al 25% de la columna más cargada.
    """
    alpha = img.getchannel("A")
    w, h = alpha.size
    px = alpha.load()
    cols = [sum(1 for y in range(h) if px[x, y] > 24) for x in range(w)]
    pico = max(cols) if cols else 0
    if not pico:
        return img

    minimo = pico * umbral
    izq = 0
    while izq < w and cols[izq] < minimo:
        izq += 1
    der = w - 1
    while der > izq and cols[der] < minimo:
        der -= 1
    return img.crop((izq, 0, der + 1, h))


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


def pad_to_ratio(img, ratio):
    """
    Agrega transparencia hasta llegar EXACTAMENTE a la proporción pedida, con el
    bicho centrado. Ensancha o alarga según haga falta.

    Es la solución de fondo al problema que arrastramos: el motor mete cada
    cuadro en una caja FIJA, así que cualquier cuadro con otra proporción sale
    deformado. Si se rellena hasta la proporción DE LA CAJA, el calce es exacto
    y no se deforma ninguno.

    Ojo: hay que pasarle la proporción de la caja del enemigo (e.w/e.h), no el
    máximo del grupo. Igualar los cuadros entre sí evita que el bicho lata al
    animarse, pero si esa proporción no es la de la caja, TODOS salen
    deformados por igual — que es un error más difícil de ver y no menos malo.
    """
    actual = img.width / img.height
    if abs(actual - ratio) < 0.005:
        return img

    if actual < ratio:                      # falta ancho
        w = max(1, round(img.height * ratio))
        lienzo = Image.new("RGBA", (w, img.height), (0, 0, 0, 0))
        lienzo.alpha_composite(img, ((w - img.width) // 2, 0))
        return lienzo

    h = max(1, round(img.width / ratio))    # falta alto
    lienzo = Image.new("RGBA", (img.width, h), (0, 0, 0, 0))
    lienzo.alpha_composite(img, (0, (h - img.height) // 2))
    return lienzo


# ── Hojas de sprites ─────────────────────────────────────────────────────────

def split_sheet(img, cols, rows):
    """
    Parte una hoja en celdas iguales. Sólo sirve si ChatGPT respetó la grilla,
    cosa que no siempre hace: cuando los cuadros vienen desparejos o el bicho no
    está centrado en su celda, esto los corta al medio. Para eso está --auto.
    """
    fw, fh = img.width // cols, img.height // rows
    return [
        img.crop((c * fw, r * fh, (c + 1) * fw, (r + 1) * fh))
        for r in range(rows)
        for c in range(cols)
    ]


def find_sprites(img, min_area_ratio=0.004, gap_ratio=0.008):
    """
    Encuentra los cuadros solos, sin grilla: busca las manchas de dibujo sobre
    el fondo ya transparente y devuelve una por cuadro.

    Por qué hace falta: ChatGPT entrega las hojas con separaciones irregulares y
    los bichos descentrados. Una grilla fija los corta; esto los sigue.

    El truco es la DILATACIÓN. Un pez y su estela de burbujas son manchas
    separadas, pero son el mismo cuadro. Engordando la máscara antes de agrupar,
    lo que está cerca se une; lo que está lejos —el cuadro siguiente— no.

    Se trabaja sobre una máscara reducida: 2000×900 son 1,8 millones de píxeles
    y agrupar eso en Python puro tarda; a un octavo es instantáneo y la caja
    resultante se reescala igual de bien.
    """
    alpha = img.getchannel("A")
    scale = max(1, img.width // 300)
    small = alpha.resize((img.width // scale, img.height // scale), Image.BILINEAR)
    w, h = small.size
    px = small.load()

    grow = max(1, int(w * gap_ratio))
    mask = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            if px[x, y] > 24:
                for dy in range(-grow, grow + 1):
                    yy = y + dy
                    if 0 <= yy < h:
                        row = yy * w
                        for dx in range(-grow, grow + 1):
                            xx = x + dx
                            if 0 <= xx < w:
                                mask[row + xx] = 1

    # Agrupar las manchas conectadas
    labels = [0] * (w * h)
    boxes = []
    for start in range(w * h):
        if not mask[start] or labels[start]:
            continue
        tag = len(boxes) + 1
        stack = [start]
        labels[start] = tag
        x0 = x1 = start % w
        y0 = y1 = start // w
        while stack:
            i = stack.pop()
            x, y = i % w, i // w
            x0, x1 = min(x0, x), max(x1, x)
            y0, y1 = min(y0, y), max(y1, y)
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h:
                    j = ny * w + nx
                    if mask[j] and not labels[j]:
                        labels[j] = tag
                        stack.append(j)
        boxes.append((x0, y0, x1, y1))

    # Fuera las motas: manchitas sueltas que no son un cuadro
    min_area = w * h * min_area_ratio
    boxes = [b for b in boxes if (b[2] - b[0] + 1) * (b[3] - b[1] + 1) >= min_area]

    # Orden de lectura: por filas y, dentro de cada fila, de izquierda a derecha
    if boxes:
        alturas = [b[3] - b[1] for b in boxes]
        tol = max(alturas) * 0.5
        boxes.sort(key=lambda b: (round(b[1] / tol) if tol else 0, b[0]))

    return [
        img.crop((b[0] * scale, b[1] * scale,
                  min(img.width, (b[2] + 1) * scale),
                  min(img.height, (b[3] + 1) * scale)))
        for b in boxes
    ]


# ── Nombres ──────────────────────────────────────────────────────────────────

def frame_name(base, index, estilo="cero"):
    """
    El proyecto usa DOS convenciones distintas, y equivocarse no rompe nada de
    forma visible: simplemente ese enemigo deja de dibujarse.

      cero   img/level3/ y img/level5/  →  fly0, fly01, fly02
             (así lo arma murcielago.js: `${anim}${i===0?'0':'0'+i}`)
      plano  img/ (raíz)                →  walker_idle0, walker_idle1
      unico  img/ (raíz), un solo cuadro →  walker_attack.png, sin número
    """
    if estilo == "unico":
        return f"{base}.png"
    if estilo == "plano":
        return f"{base}{index}.png"
    return f"{base}{index}.png" if index == 0 else f"{base}0{index}.png"


# ── Programa ─────────────────────────────────────────────────────────────────

def gather_inputs(path, grid, auto, tol, union=0.8):
    if os.path.isdir(path):
        names = sorted(
            f for f in os.listdir(path)
            if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))
        )
        return [Image.open(os.path.join(path, n)) for n in names], False

    img = Image.open(path)

    if auto:
        # El fondo se quita ANTES de buscar: los cuadros se detectan como
        # manchas de dibujo, y para eso el fondo tiene que ser transparente.
        limpia = despeckle_edges(remove_background(img, tol))
        return find_sprites(limpia, gap_ratio=union / 100.0), True

    if grid:
        cols, rows = (int(v) for v in grid.lower().split("x"))
        return split_sheet(img, cols, rows), False

    return [img], False


def main():
    ap = argparse.ArgumentParser(description="Deja listos los sprites de ChatGPT.")
    ap.add_argument("entrada", help="Imagen, hoja o carpeta")
    ap.add_argument("--nombre", required=True, help="Base del nombre (ej: cangrejo_walk)")
    ap.add_argument("--salida", default="img/level5", help="Carpeta destino")
    ap.add_argument("--alto", type=int, default=0, help="Altura final en px")
    ap.add_argument("--tol", type=int, default=12, help="Tolerancia del fondo (default 12)")
    ap.add_argument("--padding", type=int, default=0, help="Margen al recortar")
    ap.add_argument("--grilla", help="Partir una hoja en celdas iguales, ej: 4x1")
    ap.add_argument("--estilo", choices=["cero", "plano", "unico"], default="cero",
                    help="Convencion de nombres: cero (level3/level5), plano (raiz img/), "
                         "unico (un solo cuadro, sin numero)")
    ap.add_argument("--sin-estela", action="store_true",
                    help="Recortar los costados de poca tinta: estelas, lineas de "
                         "velocidad y proyectiles dibujados dentro del sprite")
    ap.add_argument("--sin-motas", action="store_true",
                    help="Borrar manchitas sueltas: carteles al costado, burbujas")
    ap.add_argument("--sin-etiquetas", action="store_true",
                    help="Descartar carteles y numeros pegados arriba del sprite "
                         "(para laminas de presentacion)")
    ap.add_argument("--auto", action="store_true",
                    help="Detectar solo los cuadros de la hoja (para hojas desparejas)")
    ap.add_argument("--union", type=float, default=0.8,
                    help="Cuanto se engordan las manchas antes de agrupar, en %% del ancho "
                         "(default 0.8). Subila si un bicho se parte en dos; bajala si dos "
                         "cuadros vecinos quedan pegados.")
    ap.add_argument("--esperados", type=int, default=0,
                    help="Cuantos cuadros deberia encontrar --auto; avisa si no coincide")
    ap.add_argument("--sin-fondo", action="store_true",
                    help="La imagen ya viene sin fondo: sólo recortar y escalar")
    ap.add_argument("--previo", action="store_true", help="No escribe nada, sólo informa")
    args = ap.parse_args()

    frames, ya_limpias = gather_inputs(args.entrada, args.grilla, args.auto, args.tol, args.union)
    if not frames:
        sys.exit(f"No encontré imágenes en {args.entrada}")

    if args.auto:
        print(f"  detectados {len(frames)} cuadros")
        if args.esperados and len(frames) != args.esperados:
            print(f"  OJO: esperabas {args.esperados}. Probá con otra --tol, "
                  f"o revisá si dos cuadros quedaron pegados.")

    if not args.previo:
        os.makedirs(args.salida, exist_ok=True)

    for i, frame in enumerate(frames):
        img = frame.convert("RGBA")
        antes = img.size

        # Con --auto el fondo ya se quitó antes de recortar los cuadros.
        if not args.sin_fondo and not ya_limpias:
            img = despeckle_edges(remove_background(img, args.tol))
        if getattr(args, "sin_etiquetas", False):
            img = drop_label_bands(img)
        if getattr(args, "sin_motas", False):
            img = drop_small_blobs(img)
        if getattr(args, "sin_estela", False):
            img = trim_faint_columns(img)
        img = trim(img, args.padding)
        img = scale_to_height(img, args.alto)

        name = frame_name(args.nombre, i, args.estilo)
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
