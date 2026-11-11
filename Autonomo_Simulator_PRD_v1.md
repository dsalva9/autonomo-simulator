# AUTÓNOMO SIMULATOR
## Product Requirements Document (PRD) — v1.0

**Estado:** Documento inicial para desarrollo · **Fecha:** 10 noviembre 2026  
**Tipo:** Juego indie de parodia, decisiones y supervivencia · **Idioma inicial:** Español (España)  
**Prioridad:** Hobby, diversión y experimentación con agentes de IA; no monetización.

> **Premisa:** «Sé tu propio jefe. Descubre por qué era mala idea.»

## 1. Resumen ejecutivo

Autónomo Simulator es un minijuego satírico ambientado en España. El jugador empieza como autónomo, soltero, sin empleados y con recursos modestos. Cada turno representa un mes de actividad. Paga gastos recurrentes, gestiona ingresos, toma decisiones frente a eventos narrativos y afronta consecuencias inmediatas o diferidas. El objetivo principal es **sobrevivir diez años (120 meses)**; la partida puede continuar tras ese logro. Un objetivo alternativo es acumular **150.000 € de dinero disponible** (cifra inicial ajustable). También se puede perder por insolvencia o agotamiento personal.

El juego se concibe **mobile-first**, accesible desde navegador y preparado para empaquetarse más adelante en Android, iOS y escritorio/Steam. Los eventos y recursos gráficos deben ser **data-driven**, fácilmente ampliables y aptos para producción mediante agentes especializados.

## 2. Objetivos y principios

### 2.1 Objetivos del producto
- Divertir con humor reconocible sobre clientes, cuotas, Hacienda, gestorías, familia y empleo.
- Ofrecer decisiones con compensaciones reales, incertidumbre y consecuencias diferidas.
- Permitir partidas rejugables, comprensibles y con progresión narrativa emergente.
- Facilitar compartir resultados y el enlace al juego por WhatsApp u otros canales.
- Mantener el proyecto publicable con un alcance razonable para un hobby.

### 2.2 Objetivo paralelo: experimento multiagente
- Orquestar agentes especializados para programación, contenido narrativo y arte.
- Permitir contribuciones independientes mediante contratos estables, carpetas delimitadas, validadores y revisión humana.
- Medir la utilidad real de la colaboración sin que el proceso de agentes complique el juego.

### 2.3 Principios de diseño
1. **Los eventos son el juego**: la interfaz y la simulación sirven a las decisiones.
2. **Sencillo de construir, difícil de sobrevivir**.
3. **Sin profesión inicial**: el jugador es simplemente autónomo; los eventos evitan dependencias sectoriales salvo expansiones futuras.
4. **Humor cínico, no castigo automático**: decisiones arriesgadas pueden salir bien; relaciones y empleados aportan beneficios y costes.
5. **Contenido separado del motor**: añadir eventos ordinarios no exige modificar código.
6. **Móvil primero, escritorio diseñado de verdad**: no ampliar sin más la interfaz del teléfono.
7. **Una sola base de código** y funcionamiento local/offline cuando sea viable.

## 3. Público y plataformas

**Público principal:** jugadores hispanohablantes que reconocen la burocracia y las contradicciones del trabajo autónomo, así como aficionados a juegos narrativos de decisiones. No se exige conocer fiscalidad real.

**Plataformas y secuencia propuesta:**
1. Web HTML5, compartible mediante URL (primera publicación gratuita, por ejemplo en itch.io).
2. Android con Capacitor, tras validar experiencia táctil y requisitos de tienda.
3. iOS con Capacitor, con adaptaciones de distribución.
4. Escritorio Windows/macOS/Linux con Tauri; posible distribución en Steam.

**Nota:** la publicación en tiendas no forma parte del MVP y requiere verificar requisitos, costes, firma y políticas vigentes en el momento de lanzarlo.

## 4. Bucle principal y calendario

**Unidad temporal:** un mes por turno. **Diez años:** 120 turnos. El jugador puede seguir después del mes 120.

**Secuencia propuesta por turno:**
1. Inicio de mes: mostrar fecha, estado y avisos pendientes.
2. Aplicar ingresos/gastos recurrentes, obligaciones y efectos temporales según reglas consistentes.
3. Presentar uno o varios eventos elegibles (número acotado para evitar partidas interminables).
4. Registrar elecciones y aplicar efectos inmediatos, compromisos y eventos futuros.
5. Resolver vencimientos fiscales y financieros cuando corresponda.
6. Comprobar condiciones de derrota, victoria y logros; guardar automáticamente; avanzar al mes siguiente.

**Obligaciones fiscales:** incorporar un momento trimestral reconocible. El calendario real de declaraciones en España no coincide exactamente con «cada tercer mes»: para el juego se propone un **ciclo simplificado con hitos cada tres turnos**, explicado como abstracción humorística, no como asesoramiento fiscal. El modelo de IVA, impuestos y cuota es una simplificación deliberada, no contabilidad real.

**Duración objetivo de partida:** por validar en pruebas; se busca una experiencia breve y repetible. Si 120 turnos resultan largos, ajustar frecuencia de decisiones, ritmo y posibilidad de avance rápido sin eliminar la progresión mensual.

## 5. Estado del jugador

### 5.1 Indicadores visibles (propuesta inicial, calibrable)
| Indicador | Función | Umbral |
|---|---|---|
| Dinero disponible (€) | Liquidez para gastos y objetivo de riqueza | Insolvencia cuando no se pueden afrontar obligaciones tras mecanismos de gracia definidos |
| Moral / aguante (0–100) | Desgaste emocional, capacidad de continuar | 0: abandono por agotamiento |
| Vida personal (0–100) | Relaciones, tiempo libre y equilibrio | Impacta moral, eventos y desenlaces; no implica derrota inmediata por sí sola |
| Reputación (0–100) | Acceso a clientes y oportunidades | Afecta eventos e ingresos potenciales |

**Estrés:** puede representarse como inverso de moral o como variable separada, pero no ambas sin una razón clara. **Decisión pendiente:** escoger una sola representación para evitar redundancia en el MVP.

### 5.2 Variables internas
Riesgo fiscal, facturas por cobrar, compromisos, deudas, historial de elecciones, estados de cadenas narrativas, situación sentimental/familiar, hijos, gestor contratado, empleado (máximo uno), incidencias laborales, efectos temporales y marcadores de eventos ya vistos. Algunas pueden mostrarse en pantallas de detalle, pero no todas son barras permanentes.

### 5.3 Economía
- Ingresos por encargos/eventos y pagos diferidos; gastos fijos mensuales.
- Cuota de autónomos y obligaciones tributarias simplificadas.
- Distinguir **facturación histórica** de **dinero disponible**: el objetivo de riqueza usa este último.
- Evitar derrota instantánea por saldo negativo accidental: definir vencimientos, impagos y condiciones de insolvencia de forma transparente.
- Las cantidades, frecuencias y probabilidades deben estar parametrizadas para balance.

## 6. Sistemas narrativos

### 6.1 Clientes y trabajo
Trabajos urgentes, revisiones infinitas, impagos, ofertas dudosas, reputación, exceso de carga y oportunidades inesperadas. Ejemplo: un cliente propone pagar sin factura; aceptar da liquidez inmediata y aumenta riesgo fiscal futuro. El juego satiriza la situación sin enseñar a cometer fraude.

### 6.2 Gestor
El gestor es **personaje recurrente + gasto fijo + modificador de eventos**, no un simulador contable. El jugador puede empezar llevando sus cuentas y recibir más adelante una oferta para contratar gestor. Alternativas iniciales ilustrativas: autogestión (sin coste), gestor económico (coste menor y fiabilidad variable), asesoría premium (coste mayor y menor riesgo de error). El gestor aconseja o desbloquea opciones, pero **el jugador decide**. Se puede cambiar de gestor mediante eventos; personajes recurrentes pueden tener arcos narrativos.

### 6.3 Relaciones y familia
El jugador **empieza soltero**. Pareja, convivencia, hijos y nuevas obligaciones pueden surgir mediante eventos aleatorios condicionados y decisiones; no se eligen perfiles al inicio. Las relaciones deben aportar apoyos y oportunidades además de costes. Ejemplo: cambiar de colegio no implica automáticamente daño al menor; puede generar incertidumbre temporal y resultados diversos.

### 6.4 Empleado
El jugador puede contratar **como máximo un empleado** cuando se habilite la oportunidad. Aumenta capacidad productiva, costes fijos y variedad de eventos. Posibles situaciones: vacaciones, aumento, buen rendimiento, errores, baja, salida, conflictos laborales o propuestas irregulares. El sistema no se convierte en gestión de plantilla; su profundidad proviene de eventos y estados simples. La contratación no es obligatoria.

### 6.5 Hacienda y riesgo fiscal
Obligaciones periódicas, avisos, inspecciones y errores de declaraciones, modulados por decisiones y gestor. El riesgo puede ser parcialmente oculto para generar tensión, pero las consecuencias deben sentirse coherentes y no arbitrarias. La parodia no debe presentarse como descripción exacta de procedimientos legales.

### 6.6 Eventos encadenados
Un evento puede establecer flags, programar seguimientos en meses futuros y abrir/cerrar opciones. Las consecuencias diferidas son una característica esencial. Debe evitarse que la aleatoriedad haga inevitables las derrotas o que una estrategia domine todas las partidas.

## 7. Victoria, derrota y logros

| Resultado | Condición propuesta | Comportamiento |
|---|---|---|
| «¡Eres un héroe!» | Sobrevivir 120 meses | Pantalla de logro, felicitación sarcástica y opción de continuar |
| «Ricachón» | Alcanzar 150.000 € disponibles | Victoria económica; opción de continuar o terminar |
| Bancarrota | Incapacidad persistente de atender obligaciones | Fin de partida y resumen |
| «No puedo más» | Moral/aguante llega a 0 | Fin de partida, incluso si hay dinero |

**Finales narrativos de abandono:** preparar oposiciones, buscar trabajo asalariado o vivir de ayudas, como desenlaces satíricos opcionales. No deben caricaturizar automáticamente a personas que reciben prestaciones. **Logros intermedios:** primer trimestre, primer año, cinco años y otros hitos. **Resumen anual:** facturación, impuestos simulados, dinero restante, cambios familiares, clientes, vacaciones y eventos memorables.

**Pantalla final compartible:** años y meses sobrevividos, dinero disponible, facturación acumulada, desenlace y una frase humorística. Compartir con API nativa cuando esté disponible y alternativa de copiar texto/enlace.

## 8. Sistema de eventos declarativo (requisito crítico)

Los eventos se almacenan en archivos de texto **YAML** (elección propuesta) con esquema versionado y validación automatizada. El motor no contiene historias hardcodeadas. Deben poder agregarse, editarse y probarse eventos sin cambiar la lógica del juego, siempre que usen efectos existentes.

### 8.1 Contrato mínimo
- `id` único, `schema_version`, categoría, título, texto y etiquetas.
- Condiciones de elegibilidad (mes, flags, estado familiar, empleado, gestor, indicadores).
- Peso/frecuencia, enfriamiento, límites de repetición y exclusiones.
- Dos o más opciones con texto y efectos declarativos.
- Efectos inmediatos, temporales y diferidos; flags y programación de seguimientos.
- Referencias opcionales a personajes y assets por identificador estable.
- Localización preparada para futuro; español como contenido inicial.

### 8.2 Ejemplo ilustrativo (no esquema definitivo)

```yaml
schema_version: 1
id: cliente_pago_sin_factura
category: clientes
title: "¿Y si lo hacemos sin factura?"
body: "Un cliente ofrece 1.500 € en efectivo por un trabajo."
requirements:
  min_month: 3
weight: 10
cooldown_months: 24
choices:
  - id: aceptar
    label: "Aceptar"
    effects:
      money: 1500
      moral: -3
      fiscal_risk: 20
      set_flags: [acepto_pago_irregular]
  - id: exigir_factura
    label: "Exigir factura"
    effects:
      reputation: -2
      moral: 2
```

**Importante:** el ejemplo es un boceto editorial. Antes de producir contenido en masa hay que formalizar la semántica de ingresos, impuestos, escalas, tipos de efectos y condiciones. No se debe interpretar el ejemplo como contrato ejecutable final.

### 8.3 Reglas de extensibilidad
- El agente narrativo **no inventa** propiedades, efectos o mecánicas sin aprobación.
- Una mecánica nueva requiere propuesta, revisión de contrato, implementación y tests antes de generar eventos que la utilicen.
- Los eventos deben validarse por esquema y por reglas semánticas: IDs, referencias, rangos, elecciones, estados imposibles y cadenas huérfanas.
- Un simulador de partidas con semillas reproducibles debe detectar bucles, resultados extremos y eventos inaccesibles.

## 9. UX/UI y dirección artística

**Mobile-first** con diseño responsive deliberado. En móvil: estado compacto, evento protagonista, botones táctiles grandes y menús/pestañas para historial, finanzas, familia, gestor y empleado. En escritorio: paneles laterales persistentes y espacio para despacho/escena. No depender de hover; navegación usable con teclado y lector de pantalla cuando sea viable.

**Escena principal:** pequeño despacho con detalles que cambian por progreso, desgaste y eventos; animaciones breves, no un mundo explorable. **Estilo visual:** decisión abierta (pixel art, cómic o burocracia retro); se definirá en una guía de arte antes de producir assets a escala. **Audio:** opcional y pospuesto. Mantener contraste, legibilidad y rendimiento en móviles modestos.

## 10. Tecnología y arquitectura propuesta

- **Frontend:** React + TypeScript + Vite.
- **Estilos:** Tailwind CSS y componentes accesibles.
- **Estado:** Zustand, con separación estricta entre estado de interfaz y estado del juego.
- **Persistencia:** IndexedDB o almacenamiento local apropiado, con versión de guardado y migraciones.
- **Motor:** módulo TypeScript puro, determinista bajo semilla, desacoplado de React.
- **Contenido:** YAML validado y transformado a datos tipados en build; sin ejecución de código arbitrario en eventos.
- **Pruebas:** unitarias, validación de contenido, simulaciones y pruebas de interfaz.
- **Empaquetado futuro:** Capacitor (Android/iOS) y Tauri (escritorio/Steam).
- **Backend:** ninguno para MVP. Compartir resultados sin cuentas ni leaderboard remoto.

**Requisitos no funcionales:** guardado automático, carga rápida, juego offline tras cargar/instalar donde proceda, diseño adaptable, restauración segura de partida, accesibilidad básica, funcionamiento táctil y sin telemetría obligatoria.

## 11. Organización de repositorio y colaboración multiagente

```text
autonomo-simulator/
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── AGENTS.md
│   └── ART_DIRECTION.md
├── src/
│   ├── engine/
│   ├── components/
│   ├── screens/
│   └── services/
├── content/
│   ├── events/{clientes,hacienda,familia,empleados,gestor}/
│   └── characters/
├── assets/{characters,backgrounds,animations,ui}/
├── schemas/
│   └── event.schema.json
├── scripts/
└── tests/{events,simulation,ui}/
```

### 11.1 Agentes iniciales
| Agente | Responsabilidad | Área principal |
|---|---|---|
| Programador (Antigravity) | Motor, UI, guardado, integración, pruebas | `src/`, `tests/` |
| Narrativo | Redactar eventos, cadenas, humor y variaciones | `content/` |
| Artístico | Personajes, fondos, iconos y animaciones | `assets/` |

**Posteriormente:** agente de balance (economía/probabilidades) y QA (simulaciones, regresiones), y coordinador si el volumen lo justifica. No exigir seis agentes desde el primer día.

### 11.2 Normas operativas
- `AGENTS.md` define permisos, límites, contratos, nomenclatura, criterios de entrega y escalado.
- Cada agente trabaja en carpetas asignadas; para cambios amplios, rama o Git worktree independiente.
- Ningún agente integra cambios incompatibles sin validación; el propietario revisa los cambios de motor y mecánicas.
- El agente artístico sigue `ART_DIRECTION.md`, tamaños, paleta, formatos, transparencia, nombres y manifiesto de assets.
- El narrativo usa el esquema de eventos; si necesita una nueva mecánica, abre propuesta en lugar de modificar el motor.
- Los scripts de validación y CI verifican esquema, referencias a assets, lint, tests y simulaciones.
- La selección de proveedores/modelos puede cambiar sin alterar los contratos del proyecto.
- Las tareas deben ser pequeñas, verificables y con criterios de aceptación; registrar decisiones de arquitectura.

## 12. Alcance por fases

### Fase 0 — Prueba de arquitectura
Motor mínimo, 3–5 eventos, una pantalla responsive, guardado local y una prueba de empaquetado temprana (sin publicación). Validar contrato YAML, flujo de agente narrativo y flujo de agente artístico.

### MVP — Primera versión jugable web
- Calendario mensual y obligaciones recurrentes simplificadas.
- Indicadores, economía básica y guardado.
- Motor de eventos con condiciones, pesos y consecuencias diferidas.
- **30–50 eventos** escritos/revisados, repartidos entre clientes, Hacienda y vida personal; un pequeño arco de gestor.
- Logros, derrota por insolvencia/agotamiento, victoria por riqueza y hito de 10 años.
- Interfaz responsive y pantalla de resultado compartible.
- Validadores de contenido y simulación automatizada básica.

### Posterior al MVP
- Pareja/hijos con cadenas narrativas más extensas.
- Contratación de **un** empleado y eventos laborales.
- Mayor variedad de gestores y arcos de personajes.
- Más eventos, animaciones, logros, balance y empaquetado móvil/escritorio.

**Nota de alcance:** pareja, hijos y empleado forman parte de la visión del producto, pero su profundidad puede diferirse para asegurar una primera publicación realista. El gestor puede aparecer ya en el MVP como sistema ligero.

## 13. Criterios de aceptación del MVP

1. Una partida nueva comienza en mes 1, soltero, sin empleado, con estado inicial configurable.
2. Cada avance de mes aplica exactamente una vez los gastos e ingresos recurrentes pertinentes.
3. Cada tres turnos aparece un hito fiscal simplificado y sus consecuencias son coherentes.
4. Los eventos se cargan desde archivos validados; un archivo nuevo compatible aparece en el juego sin modificar el motor.
5. Ningún evento elegible carece de opciones válidas ni referencia assets inexistentes.
6. Las elecciones alteran el estado y pueden programar consecuencias posteriores reproducibles.
7. Guardar/cargar conserva fecha, indicadores, historial, flags y eventos pendientes.
8. Moral 0 e insolvencia conducen a finales distintos; el dinero disponible determina la victoria económica.
9. Al llegar al mes 120 se muestra el logro y el jugador puede continuar.
10. La interfaz funciona en pantallas estrechas y anchas con controles táctiles utilizables.
11. Se puede copiar/compartir un resumen de resultado sin necesidad de cuenta.
12. Los tests y simulaciones automatizados detectan eventos inválidos y regresiones críticas.

## 14. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Crecimiento incontrolado de mecánicas | MVP acotado; mecánicas nuevas por propuesta y aprobación |
| 120 turnos demasiado largos | Prototipos, avance rápido, pocos eventos por mes y pruebas de duración |
| Eventos repetitivos o sin gracia | Edición humana, cadenas, cooldowns, variedad de tono y pruebas de juego |
| Economía desequilibrada | Semillas reproducibles y simulaciones masivas |
| Agentes sobrescriben trabajo | Carpetas asignadas, Git/worktrees, contratos y validación |
| Assets inconsistentes | Guía de estilo, manifiesto y revisión visual |
| Imprecisión fiscal confundida con consejo | Simplificación explícita y evitar instrucciones legales/fiscales reales |
| Distribución multiplataforma costosa | Publicar web primero; pruebas de empaquetado tempranas |

## 15. Métricas de éxito (hobby, no negocio)

- Existe una versión pública jugable y estable.
- Se puede añadir un evento válido en minutos sin tocar código.
- Los tres agentes producen entregables integrables con poca intervención manual.
- Las partidas tienen decisiones interesantes, resultados variados y humor que funciona.
- El juego puede jugarse y compartirse desde móvil; escritorio resulta cómodo.
- El propietario disfruta del proceso y el alcance sigue siendo manejable.

## 16. Decisiones pendientes antes de implementación extensa

1. Escala definitiva: **moral + vida personal + reputación**, y si estrés es derivado o independiente.
2. Reglas exactas de economía, impuestos simplificados, deudas e insolvencia.
3. Duración de partida deseada y número máximo de eventos por mes.
4. Esquema YAML v1 definitivo, catálogo de efectos y condiciones.
5. Diseño artístico y especificaciones de assets.
6. Equilibrio de aparición de pareja, hijos y empleado; prioridad en el roadmap.
7. Semántica de resultados tras el mes 120 y después de alcanzar 150.000 €.
8. Estrategia de integración de agentes y validación automática en el repositorio.

## 17. Siguientes entregables recomendados

- `ARCHITECTURE.md`: módulos, estados, contratos, guardado, build y estrategia multiplataforma.
- `AGENTS.md`: instrucciones por rol, permisos, revisión, ramas y definición de terminado.
- `event.schema.json` + catálogo de efectos: contrato ejecutable antes de generar decenas de eventos.
- `ART_DIRECTION.md`: dirección visual, formatos y convenciones para el agente artístico.
- Vertical slice: un mes jugable, un evento con seguimiento, un trimestre, un final y guardado.

---

**Criterio rector:** el juego debe seguir siendo pequeño y divertido aunque detrás haya una orquesta de agentes. La complejidad de producción no debe trasladarse al jugador.
