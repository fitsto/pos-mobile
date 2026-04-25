# CLAUDE.md — pos-mobile (POS Tienda)

## Objetivo del producto

App móvil React Native + Expo para operadores de la **Tienda** del
ecosistema SaaS. Es el POS de mostrador: registra ventas, ajusta stock,
gestiona clientes (por RUT) y soporta operación offline con cola de
sincronización. Identidad la provee `identity-central`; los datos
operativos los provee `api-store`.

## Stack técnico

- **Runtime**: React Native + Expo (managed workflow) + expo-router (file based).
- **Lenguaje**: TypeScript estricto.
- **Estado global**: Zustand (`src/runtime/stores/*`).
- **Persistencia local**: `expo-sqlite` para catálogo offline + cola de ventas pendientes.
- **Sesión segura**: `expo-secure-store`.
- **HTTP**: cliente propio en `src/contexts/shared/infrastructure/http/HttpClient.ts`.
- **Auth operador**: JWT emitido por `identity-central`, validado por `api-store`.
- **UI**: design system propio en `src/runtime/components/ui/` + tema en `src/runtime/theme/`.
- **Tests**: Vitest (`vitest.config.ts`) — sólo unitarios de dominio + casos de uso.

## Arquitectura — Reglas estrictas

Hexagonal por contexto de dominio. Flujo siempre:

```
Pantalla (app/...) → UseCase (container DI) → Repository (interface) → HttpRepository / SqliteRepository
```

**Nunca:**
- Llamar `fetch` directamente desde una pantalla.
- Lógica de negocio en componentes.
- Más de una clase por archivo.
- Importar desde `infrastructure/` en `domain/`.

**Siempre:**
- Un use case por acción (`<Accion><Entidad>UseCase.ts`).
- Inyección por `src/runtime/di/container.ts` (instanciación única, importable como `container.<useCase>`).
- Domain primero: tipos puros, sin dependencias de Expo / RN.
- IDs UUID excepto `organizationId` (lo emite Better Auth — alfanumérico).

## Estructura de carpetas

```
app/                        # File-based routing (expo-router)
├── (tabs)/                 # Tabs principales: pos, historial, productos, cuenta, pendientes
├── producto/               # [id].tsx detalle, nuevo.tsx wizard, ajustar.tsx ajuste de stock
├── login.tsx
├── seleccionar-negocio.tsx
└── catalogo-venta.tsx      # Catálogo con búsqueda+scanner para agregar al carrito POS

src/
├── contexts/               # Hexagonal — un subdir por bounded context
│   ├── auth/               # Login, refresh, restaurar sesión
│   ├── tienda/             # Listar mis tiendas
│   ├── producto/           # Buscar, crear, actualizar, imágenes, categorías/marcas
│   ├── producto-maestro/   # Búsqueda en catálogo central por código de barras
│   ├── stock/              # Listar stock por ubicación o producto
│   ├── ubicacion/
│   ├── venta/              # Crear venta, listar, obtener detalle (incluye cliente)
│   ├── caja/               # Apertura/cierre/movimientos
│   ├── ajuste-inventario/  # Registrar ajuste + listar movimientos (ventas + ajustes unificados)
│   ├── cliente/            # Buscar por RUT (+ utilidades de validación de RUT chileno)
│   ├── catalogo-local/     # Espejo SQLite del catálogo (offline)
│   ├── offline-queue/      # Cola de ventas creadas offline para reintentar al reconectar
│   └── shared/             # HttpClient, errores, etc.
├── runtime/
│   ├── components/         # UI compartida (Sheet, Card, TextField, Modales: Cobro, Cliente, Scanner, …)
│   ├── catalogo/           # CatalogoSyncManager (sync incremental con backend)
│   ├── di/container.ts     # Wiring de repos + use cases
│   ├── offline/OfflineQueueManager.ts
│   ├── stores/             # Zustand: SesionStore, CarritoStore, …
│   ├── theme/              # ThemeProvider + tokens de color, espaciado, tipografía
│   └── utils/              # formato CLP, fechas, etc.
└── ...
```

## Reglas de negocio clave

- **Sesión única por dispositivo**: tras login el operador elige negocio (tienda); el `negocioId` (=`organizationId`) viaja en el path de cada request.
- **Roles**: `ADMIN | CAJERO | VENDEDOR`. VENDEDOR ve sólo ventas/stock de su sucursal. El backend filtra; el frontend asume lo que recibe.
- **POS offline**: si no hay red al confirmar venta, se persiste en `OfflineQueueRepository` (SQLite). Al volver la red, `OfflineQueueManager` reintenta con `clientVentaId` (UUID del dispositivo) — el backend es idempotente por ese campo.
- **Clientes por RUT**: el RUT es el identificador único de cliente en la tienda. Se ingresa **sin puntos ni guión**, sólo dígitos + DV (puede ser `K`). Ejemplo: `15.776.894-8` se entra como `157768948`. La utilidad `validarRut` normaliza al formato canónico `12345678-9`.
- **Flujo cliente al cobrar**: `ClienteModal` ofrece "Tengo RUT" (busca → usa o registra) o "Saltar" (venta sin cliente). No existe la opción "registrar sin RUT".
- **Variantes**: si el producto tiene `Modelo`, el `SelectorVarianteModal` aparece al agregar al carrito y el `varianteId` viaja con cada item.
- **Stock**: descuento implícito por venta (backend). Ajustes manuales se registran con motivo (`AjusteInventarioRepository.registrar`) y aparecen junto a las ventas en el historial unificado del producto (`tipo: 'AJUSTE' | 'VENTA'`, `cantidad` con signo).
- **Refresh on focus**: pantallas que muestran datos volátiles (historial, stock del producto) usan `useFocusEffect` para recargar al volver, sin requerir pull-to-refresh.

## Skills instaladas (Claude Code)

Listadas en `skills-lock.json` y desplegadas en `.claude/skills/` (gitignoreado, por máquina):

| Skill | Origen | Para qué |
|---|---|---|
| `clean-code` | `sickn33/antigravity-awesome-skills` | Principios de código limpio. |
| `clean-ddd-hexagonal` | `ccheney/robust-skills` | DDD táctico/estratégico, hexagonal, CQRS — fuente de la arquitectura del repo. |
| `frontend-design` | `anthropics/skills` | Lineamientos de diseño visual. |
| `react-native-testing` | `callstack/react-native-testing-library` | Patrones de testing en RN. |
| `ui-ux-pro-max` | `nextlevelbuilder/ui-ux-pro-max-skill` | Heurísticas de UX. |
| `vercel-react-native-skills` | `vercel-labs/agent-skills` | Convenciones RN/Expo. |

Para reinstalar en otra máquina: el set vive en `skills-lock.json`. Sincronizar con la herramienta que el equipo use para resolver skills (clonar cada repo origen al directorio `.claude/skills/<nombre>/`).

## Variables de entorno y config

Configuración por `app.json` → `expo.extra`:

```jsonc
{
  "expo": {
    "extra": {
      "apiUrl": "http://10.0.2.2:3001",       // api-store
      "identityUrl": "http://10.0.2.2:3002"   // identity-central
    }
  }
}
```

Se acceden via `expo-constants` (`Constants.expoConfig.extra.apiUrl`).

## Comandos frecuentes

```bash
pnpm install
pnpm exec tsc --noEmit         # Typecheck
pnpm exec vitest run            # Unit tests
npx expo start                 # Dev server (Metro)
npx expo run:android           # Build + correr en emulador
```

## Notas importantes para retomar el desarrollo

- El backend `api-store` ya migró de Supabase a Neon + R2; el frontend sólo cambia `apiUrl`. Nunca instanciar `@supabase/supabase-js` (paquete legacy).
- Si una pantalla no refresca al volver, casi seguro le falta `useFocusEffect`.
- Cualquier modal de input que ofrezca cantidades o RUT: NO formatear durante `onChangeText` (rompe el cursor en RN). Validar/formatear en submit.
- El historial unificado producto-level vive en el endpoint `GET /tiendas/:org/ajustes-inventario` (no en `/ventas`) — soporta filtro por `productoId`.
- Para typecheck correr siempre `npx tsc --noEmit` antes de commitear; hay errores pre-existentes con la prop `mono` en el componente `Text` que NO son introducidos por cambios nuevos (ignorables).
