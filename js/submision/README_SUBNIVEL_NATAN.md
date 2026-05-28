# Subnivel Super Natan — versión modular

## Orden de carga recomendado en `index.html`

```html
<script src="submision/subnivel_natan_config.js"></script>
<script src="submision/subnivel_natan_assets.js"></script>
<script src="submision/subnivel_natan_enemies.js"></script>
<script src="submision/subnivel_natan_renderer.js"></script>
<script src="submision/submision_natan.js"></script>
```

## Assets esperados

Base:

```text
img/nivel3/subnivel/
```

Archivos principales:

```text
transicion.png
fondo0.png
fondo1.png
fondo2.png
fondo3.png
fondo4.png
fondo5.png
fondo6.png
fondo7.png
cielo_rosario.png
veterinaria.png
portal.png
```

Sprites de Natan:

```text
natan_fly0.png ... natan_fly3.png
natan_attack0.png ... natan_attack3.png
natan_hurt0.png ... natan_hurt2.png
```

El código tiene fallback visual si algún asset todavía no existe.
