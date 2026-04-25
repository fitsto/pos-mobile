# pos-mobile

App móvil POS (React Native + Expo) para operadores de la **Tienda** del ecosistema SaaS. Es el POS de mostrador: registra ventas, ajusta stock, gestiona clientes por RUT y soporta operación offline con cola de sincronización.

- Identidad la provee [`identity-central`](../identity-central).
- Datos operativos los provee [`api-store`](../api-store).

## Stack

- React Native + Expo (managed) + expo-router (file-based routing)
- TypeScript estricto
- Zustand (estado global) + `expo-sqlite` (catálogo offline + cola de ventas)
- `expo-secure-store` (sesión)
- Vitest (unit tests de dominio + use cases)

## Arquitectura

Hexagonal por contexto de dominio:

```
Pantalla (app/...) → UseCase (container DI) → Repository (interface) → HttpRepository / SqliteRepository
```

Detalle completo en [`CLAUDE.md`](./CLAUDE.md) — incluye reglas, estructura de carpetas, reglas de negocio (POS offline, RUT, variantes, refresh-on-focus) y skills instaladas.

## Setup

```bash
pnpm install
```

Configuración en `app.json` → `expo.extra`:

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

## Comandos

```bash
pnpm exec tsc --noEmit         # Typecheck
pnpm exec vitest run           # Unit tests
npx expo start                 # Dev server (Metro)
npx expo run:android           # Build + correr en emulador
```

## Ecosistema

| Repo | Rol |
|---|---|
| `identity-central` | Auth + organizaciones + JWT compartido |
| `api-store` | Backend POS/ecommerce (catálogo, stock, ventas, caja) |
| `pos-mobile` | **Este repo** — POS móvil para operadores |
| `web-admin` | Panel admin tienda |
| `web-tienda` | Storefront público |
