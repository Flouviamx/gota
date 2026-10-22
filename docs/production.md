# Producción con agentes

> **Alcance:** cómo se dibujan los íconos en rondas de agentes en paralelo, qué recibe cada agente y cómo se revisa. Los scripts de cada ronda viven en la sesión de Claude Code que los lanzó; aquí queda lo esencial para repetirlos.

[← Índice](./README.md)

## Cómo es una ronda
- La lanza la sesión principal con la herramienta de workflows: una **pipeline** por categoría (cada categoría avanza sola, sin esperar a las demás).
- En una Mac de 8 núcleos corren **6 agentes a la vez**; el resto espera turno.
- Ritmo observado: ~1,000 íconos (9 categorías × ~105, con crítico) en unas 3 horas.
- Los agentes trabajan solo en este repo, editan **únicamente** su archivo (`src/icons/<categoría>.mjs` o `src/i18n/<categoría>.json`), no hacen commit ni instalan nada. La sesión principal revisa, corre el QA y hace el commit.
- Su cwd suele ser otro repo (`flouvia-web`): se les dice explícitamente que trabajen en `~/Desktop/flouvia-icons` y que los pasos de arranque de ese otro repo no aplican.

## Lo que todo agente que dibuja recibe
1. Leer completos `DESIGN.md`, `engine/geometry.mjs` y `src/icons/nucleo.mjs`, y mirar las hojas del núcleo: el núcleo es la vara.
2. Nivel Apple, metáforas propias, nada copiado de otras librerías, nada translúcido.
3. El formato del archivo y la lista de nombres ya usados.
4. Su categoría con un **alcance explícito** y la lista de las demás categorías (para no invadir).
5. Proceso por lotes de ~20: dibujar → `build.mjs --check` → `sheet.mjs` → **abrir cada PNG con Read** → corregir.
6. Devolver un resultado estructurado: categoría, número, nombres y notas.

## Ronda 1 — dibujo base (21 oct 2026)
Pipeline por categoría: **dibujante → crítico independiente**. El crítico no confía en el dibujante: abre cada página, rediseña los débiles (no los maquilla), cuida firma, keylines, recortes, separaciones y legibilidad a 18 px, y deja ≥ 100 buenos.
| Categoría (`id`) | Alcance |
|---|---|
| Navegación (`navegacion`) | Flechas en 8 direcciones y variantes, chevrons, carets, expandir, ordenar, deshacer, menús, paneles, vistas, filtro, cursor |
| Edición y texto (`edicion`) | Copiar, pegar, borrar, formato de texto, alineación, listas, imagen, pinceles, zoom, marcadores, compartir, descargar |
| Comunicación y personas (`comunicacion`) | Globos (`drop()`), correo, llamadas, video, micrófono, notificaciones, personas, contactos, reacciones |
| Archivos y nube (`archivos`) | Archivos por tipo y estado, carpetas, nube, discos, adjuntos, portapapeles, libros, versiones |
| Comercio y finanzas (`comercio`) | Carrito, bolsa, tienda, recibo, factura, precio, cupón, cartera, tarjetas, dinero, banco, envíos, inventario |
| Datos y desarrollo (`datos`) | Gráficas, tendencias, tableros, código, git, APIs, servidores, redes, IA, despliegue, monitoreo |
| Dispositivos y multimedia (`dispositivos`) | Teléfono, laptop, periféricos, batería, conectividad, controles de reproducción, audio, video, foto |
| Tiempo, lugares y naturaleza (`lugares`) | Calendario, relojes, mapas, edificios, transporte, clima, naturaleza |
| Sistema, seguridad y estado (`sistema`) | Candados, escudos, biometría, ajustes, power, sesión, info/ayuda/alerta, estados, premios, herramientas |
El núcleo (`nucleo`, 50) lo dibujó la sesión principal y es la referencia.

## Ronda 2 — completar los primeros ~1,000 (siguiente)
1. **Cobertura** (1 agente, primero y solo): lista de conceptos comunes de UI/web/negocio, cruce contra nombres y tags de todo el set, y dibujo de lo que falte en su categoría correcta.
2. Por cada una de las 10 categorías, en paralelo:
   - **Diseño:** pasa toda insignia a `badge` del motor (sin cortes a mano) y todo puntero a `cursor()`; `fill` (u `false`), `variants` a apagar, `mirror`, `levels`, `parts` (obligatorio con movimiento, niveles o insignia; `level`/`progress` en los de cantidad), `motion`, `small` donde 16 px no se lea, orden de dibujo en `d`; deja `qa.mjs` de su categoría en **cero avisos** (área, denso, silueta, doble, suelto, roza). No renombra, agrega ni quita íconos.
   - **Idiomas:** `src/i18n/<categoría>.json` con las 10 etiquetas y ≥ 6 palabras de búsqueda en es y en, pensadas por significado y uso. No toca los `.mjs`.
3. La sesión principal corre `qa.mjs` completo, corrige, presenta una muestra al dueño y hace commit.

## Rondas 3 en adelante — escalar a 10,000
Cada agente entrega **todo de una vez** (contorno, relleno, 16 px, piezas, movimiento, niveles, espejo e idiomas), seguido de crítico y QA. La taxonomía de los 9,000 restantes se define antes de la ronda 3 ([roadmap](./roadmap.md)).
