# Documentación de Gota

Memoria del proyecto, por dominio, para que cada tarea cargue solo lo que necesita.

## Matriz de carga
| Si la tarea toca… | Lee primero | Complementa con |
|---|---|---|
| Dibujar o corregir íconos | [`DESIGN.md`](../DESIGN.md) | [Formato](./format.md) · [Producción](./production.md) |
| El formato de un ícono (`fill`, `small`, `parts`, `motion`, `levels`, idiomas…) | [Formato](./format.md) | [`DESIGN.md`](../DESIGN.md) |
| `engine/` (geometría, variantes, 16 px, espejo, movimiento) | [Motor](./engine.md) | [Calidad](./quality.md) |
| `scripts/build.mjs`, `dist/`, el paquete o qué se publica | [Build](./build.md) | [Roadmap](./roadmap.md) |
| Lanzar o planear una ronda de agentes | [Producción](./production.md) | [Calidad](./quality.md) · [Roadmap](./roadmap.md) |
| QA, pruebas, hojas de revisión | [Calidad](./quality.md) | [Motor](./engine.md) |
| Proponer algo nuevo | [Decisiones](./decisions.md) | [Roadmap](./roadmap.md) |

## Contrato de mantenimiento
- Una regla vive en un solo documento; los demás enlazan.
- Un cambio de formato, motor o salidas actualiza su documento en el mismo commit.
- Toda decisión nueva (aceptada, distinta o descartada) entra a [Decisiones](./decisions.md) con su motivo.
- Cada sesión que avanza el proyecto agrega su entrada a [Historia](./history.md) y marca el avance en [Roadmap](./roadmap.md).
- Cada archivo, función, campo o comando que se nombra existe en el código de hoy.
