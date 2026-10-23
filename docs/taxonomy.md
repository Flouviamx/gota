# Taxonomy

> **Source of truth:** `src/taxonomy.json` (every category, its domain, round, target, scope, exclusions, and adoptions), checked by `scripts/load.mjs` and `tests/taxonomy.test.mjs`. This page holds the rules; the categories themselves live only in the JSON.

[← Index](./README.md)

## The plan
The first 1,033 icons (rounds 1 and 2) cover the interface and the most common business objects. The whole set is planned as **81 categories in 11 domains**: the first ten, which grow once, and 71 new ones, drawn in nine rounds of about 1,000:

| Round | Theme | Categories |
|---|---|---|
| 3 | Interface and work | controles, ventanas, simbolos, formas, calendario, oficina, social, producto; navegacion and edicion grow |
| 4 | Business | negocios, marketing, rrhh, soporte, legal, logistica, bienes-raices; archivos, comercio, and comunicacion grow |
| 5 | Technology | ia, desarrollo, redes, hardware, ciberseguridad; datos, sistema, and dispositivos grow |
| 6 | Home and food | hogar, electrodomesticos, limpieza, cocina, comida, frutas-verduras, bebidas, restaurante, bebes, mascotas |
| 7 | People and health | personas, gestos, emociones, salud, anatomia, bienestar, fitness, belleza, ropa, accesibilidad |
| 8 | Places and travel | vehiculos, conduccion, aviacion, nautica, transito, viajes, senales, camping; lugares grows |
| 9 | Science and industry | ciencia, espacio, educacion, industria, construccion, herramientas, energia, seguridad-laboral, agricultura |
| 10 | Leisure and culture | deportes, juegos, musica, foto-video, arte, entretenimiento, fiestas, lectura |
| 11 | Nature, and reaching 10,000 | animales, aves-insectos, mar, plantas, clima, medio-ambiente; then the sweep |

The targets add up to 8,570 new icons. With the first thousand that leaves about 400 for **the sweep** at the end of round 11: the names the migration maps still can't place (Lucide, Heroicons, SF Symbols) and the gaps the rounds left, each assigned to the category whose scope holds it, until the set lands on exactly 10,000.

The order puts first what the teams that use Gota reach for most (interface, business, technology), then the broad consumer domains, then nature.

## Rules
- **One concept, one icon.** Synonyms are tags and search keywords, never a second drawing. A second icon of the same object is allowed only when it shows something else: a view (`car` and its side), a kind (a sedan, a pickup), or a state the interface needs.
- **A category is one agent's file and a browsing unit** of about 100–150 icons; domains group categories in the explorer. A category's `scope` is what it draws; its `exclude` names where the neighbors' concepts go.
- **The first ten categories grow once,** in the round of their domain (`round` and `target` on a drawn category), so a family like `mail-*` keeps growing where it started.
- **Adoption, not moves.** When a new category takes over a family the first thousand drew elsewhere (the weather in `lugares`, AI in `datos`), it lists those icons in `adopts`. Once the new category's file exists, the loader shows, builds, and searches them under it; their source and languages stay in the file where they were drawn, and their names and codepoints never change. A first-thousand category whose families leave changes its label when they do (`datos` becomes *Datos y analítica*, `lugares` becomes *Lugares y mapas*).
- **The engine's variants are never names:** no `-circle`, `-square`, `-slash`, `-fill`, or weight suffixes for what the engine draws (a hand-drawn variant exists only where the engine's doesn't work, as `pick` documents). **Badges:** an object gets a badge sibling only for a real action or state on it (`file-plus`, `person-check`), and at most one in five of a category's icons is one; directions come from `turnPath` and `flipPath`.
- **Names:** English kebab-case. The family's head goes first where the family shares a base drawing (`chart-pie`, `car-electric`); plain English otherwise (`piggy-bank`, `soccer-ball`).
- **Out of the set:** third-party logos and trademarks (brands, social networks, payment networks, languages and tools); flags and country outlines; religious and political symbols (one generic place of worship is allowed); weapons, other than tools, sports equipment, and game pieces; words, abbreviations, and non-Latin scripts (letters only as single glyphs in `simbolos`); real people and real monuments; anything that can't read at 18 px.

## How a round uses it
1. **Names first** (one agent per category): about 15 % more candidates than the target, each with its meaning, the closest existing icon, and why it isn't the same. It reads the category's scope and exclusions, the other categories' scopes, the set's names and tags, and the names the migration maps can't place yet.
2. **Deduplication in code:** names already taken, names proposed twice in the round, and near matches by the search index (`engine/search.mjs` over every icon's tags and keywords) become a conflict list.
3. **One judge** settles the conflicts for the whole round: keep, rename, move to another category, or drop. The approved lists are what the illustrators draw; they may drop a name, never add one.
4. Then drawing, critic, languages, and QA as in [Production](./production.md#rounds-3-onward--scaling-to-10000).

A category's target is a goal, not a quota: the critic drops what doesn't reach the bar, and the sweep makes up the difference.
