import * as SQLite from 'expo-sqlite';
import type {
  BuscarProductosLocalParams,
  CatalogoLocalRepository,
  ProductoLocalConStock,
} from '../domain/CatalogoLocalRepository';
import type {
  CatalogoConfig,
  CatalogoModelo,
  CatalogoProducto,
  CatalogoSnapshot,
  CatalogoVariante,
} from '../domain/CatalogoSnapshot';

const DB_NAME = 'catalogo_local.db';

const KEY_LAST_SYNC = 'lastSyncAt';
const KEY_UBICACION = 'ubicacionId';
const KEY_CONFIG = 'config';
const KEY_SCHEMA_VERSION = 'schemaVersion';

/**
 * Versión lógica del schema/datos del catálogo local. Bumpear cuando se
 * agregan campos cuyo backfill no es posible vía diff (porque las filas
 * existentes no van a aparecer en el próximo diff). El guard en init()
 * limpia `lastSyncAt` y dispara un re-snapshot.
 *
 * Historial:
 *   1: inicial
 *   2: agregado `imagen_url` en productos.
 */
const CURRENT_SCHEMA_VERSION = '2';

interface ProductoRow {
  id: string;
  organization_id: string;
  categoria_id: string | null;
  marca_id: string | null;
  nombre: string;
  codigo_interno: string | null;
  codigo_barra: string | null;
  costo_neto: number | null;
  precio_venta_final: number;
  precio_venta_neto: number | null;
  precio_oferta: number | null;
  tipo: string;
  activo: number;
  usa_variantes: number;
  imagen_url: string | null;
  updated_at: string;
}

interface VarianteRow {
  id: string;
  producto_id: string;
  modelo_id: string | null;
  talla: string | null;
  sku: string | null;
  codigo_barra: string | null;
  precio_venta_final: number | null;
  precio_venta_neto: number | null;
  costo_neto: number | null;
  activo: number;
  orden: number;
  updated_at: string;
}

interface ModeloRow {
  id: string;
  producto_id: string;
  nombre: string;
  imagen_url: string | null;
  orden: number;
  activo: number;
  updated_at: string;
}

function rowToProducto(r: ProductoRow): CatalogoProducto {
  return {
    id: r.id,
    organizationId: r.organization_id,
    categoriaId: r.categoria_id,
    marcaId: r.marca_id,
    nombre: r.nombre,
    codigoInterno: r.codigo_interno,
    codigoBarra: r.codigo_barra,
    costoNeto: r.costo_neto != null ? Number(r.costo_neto) : null,
    precioVentaFinal: Number(r.precio_venta_final),
    precioVentaNeto: r.precio_venta_neto != null ? Number(r.precio_venta_neto) : null,
    precioOferta: r.precio_oferta != null ? Number(r.precio_oferta) : null,
    tipo: r.tipo,
    activo: r.activo === 1,
    usaVariantes: r.usa_variantes === 1,
    imagenUrl: r.imagen_url ?? null,
    updatedAt: r.updated_at,
  };
}

function rowToVariante(r: VarianteRow): CatalogoVariante {
  return {
    id: r.id,
    productoId: r.producto_id,
    modeloId: r.modelo_id,
    talla: r.talla,
    sku: r.sku,
    codigoBarra: r.codigo_barra,
    precioVentaFinal: r.precio_venta_final != null ? Number(r.precio_venta_final) : null,
    precioVentaNeto: r.precio_venta_neto != null ? Number(r.precio_venta_neto) : null,
    costoNeto: r.costo_neto != null ? Number(r.costo_neto) : null,
    activo: r.activo === 1,
    orden: Number(r.orden),
    updatedAt: r.updated_at,
  };
}

function rowToModelo(r: ModeloRow): CatalogoModelo {
  return {
    id: r.id,
    productoId: r.producto_id,
    nombre: r.nombre,
    imagenUrl: r.imagen_url,
    orden: Number(r.orden),
    activo: r.activo === 1,
    updatedAt: r.updated_at,
  };
}

export class SqliteCatalogoLocalRepository implements CatalogoLocalRepository {
  private db: SQLite.SQLiteDatabase | null = null;

  private async getDb(): Promise<SQLite.SQLiteDatabase> {
    if (!this.db) {
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
    }
    return this.db;
  }

  async init(): Promise<void> {
    const db = await this.getDb();
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS productos (
        id TEXT PRIMARY KEY NOT NULL,
        organization_id TEXT NOT NULL,
        categoria_id TEXT,
        marca_id TEXT,
        nombre TEXT NOT NULL,
        codigo_interno TEXT,
        codigo_barra TEXT,
        costo_neto REAL,
        precio_venta_final REAL NOT NULL,
        precio_venta_neto REAL,
        precio_oferta REAL,
        tipo TEXT NOT NULL,
        activo INTEGER NOT NULL DEFAULT 1,
        usa_variantes INTEGER NOT NULL DEFAULT 0,
        imagen_url TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre);
      CREATE INDEX IF NOT EXISTS idx_productos_codigo_barra ON productos(codigo_barra);
      CREATE INDEX IF NOT EXISTS idx_productos_codigo_interno ON productos(codigo_interno);

      CREATE TABLE IF NOT EXISTS variantes (
        id TEXT PRIMARY KEY NOT NULL,
        producto_id TEXT NOT NULL,
        modelo_id TEXT,
        talla TEXT,
        sku TEXT,
        codigo_barra TEXT,
        precio_venta_final REAL,
        precio_venta_neto REAL,
        costo_neto REAL,
        activo INTEGER NOT NULL DEFAULT 1,
        orden INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_variantes_producto ON variantes(producto_id);
      CREATE INDEX IF NOT EXISTS idx_variantes_codigo_barra ON variantes(codigo_barra);
      CREATE INDEX IF NOT EXISTS idx_variantes_sku ON variantes(sku);

      CREATE TABLE IF NOT EXISTS modelos (
        id TEXT PRIMARY KEY NOT NULL,
        producto_id TEXT NOT NULL,
        nombre TEXT NOT NULL,
        imagen_url TEXT,
        orden INTEGER NOT NULL DEFAULT 0,
        activo INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_modelos_producto ON modelos(producto_id);

      CREATE TABLE IF NOT EXISTS categorias (
        id TEXT PRIMARY KEY NOT NULL,
        nombre TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS marcas (
        id TEXT PRIMARY KEY NOT NULL,
        nombre TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS stock_local (
        producto_id TEXT NOT NULL,
        variante_id TEXT NOT NULL DEFAULT '',
        ubicacion_id TEXT NOT NULL,
        cantidad REAL NOT NULL DEFAULT 0,
        updated_at TEXT,
        PRIMARY KEY (producto_id, variante_id, ubicacion_id)
      );
      CREATE INDEX IF NOT EXISTS idx_stock_ubicacion ON stock_local(ubicacion_id);

      CREATE TABLE IF NOT EXISTS sync_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT
      );
    `);

    // Migración aditiva: si la app venía corriendo con un schema viejo, le
    // agregamos la columna nueva. SQLite no tiene "ADD COLUMN IF NOT EXISTS"
    // así que detectamos via PRAGMA antes de intentar.
    const seAgregoImagen = await this.ensureColumn(db, 'productos', 'imagen_url', 'TEXT');

    // Si recién agregamos `imagen_url`, las filas existentes la tienen `null`
    // y la próxima sync sería un diff (sólo trae productos con updatedAt
    // posterior al último sync) → las imágenes nunca llegarían. Forzamos una
    // re-sincronización inicial limpiando lastSyncAt.
    if (seAgregoImagen) {
      await db.runAsync(`DELETE FROM sync_meta WHERE key = ?`, KEY_LAST_SYNC);
    }

    // Guard adicional por si la columna ya fue creada en una corrida anterior
    // pero los datos viejos quedaron sin imagen_url (porque el diff no los
    // re-trajo): si la versión guardada no coincide con la actual, también
    // forzamos full sync. Una sola vez por bump.
    const versionGuardada = await this.getMeta(KEY_SCHEMA_VERSION);
    if (versionGuardada !== CURRENT_SCHEMA_VERSION) {
      await db.runAsync(`DELETE FROM sync_meta WHERE key = ?`, KEY_LAST_SYNC);
      await this.setMeta(KEY_SCHEMA_VERSION, CURRENT_SCHEMA_VERSION);
    }
  }

  /** Devuelve true si tuvo que crear la columna (no existía). */
  private async ensureColumn(
    db: SQLite.SQLiteDatabase,
    table: string,
    column: string,
    type: string,
  ): Promise<boolean> {
    const cols = await db.getAllAsync<{ name: string }>(
      `PRAGMA table_info(${table})`,
    );
    if (cols.some((c) => c.name === column)) return false;
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    return true;
  }

  async buscarProductos({
    q,
    ubicacionId,
    limit = 50,
    categoriaIds,
    marcaIds,
    soloConStock,
  }: BuscarProductosLocalParams): Promise<ProductoLocalConStock[]> {
    const db = await this.getDb();
    const texto = q.trim();

    // Construimos la cláusula WHERE de manera dinámica para soportar todos los
    // filtros opcionales (texto + categorías + marcas). El stock se filtra en
    // un segundo paso porque depende del agregado por ubicación.
    const where: string[] = ['activo = 1'];
    const args: (string | number)[] = [];

    if (texto.length > 0) {
      const like = `%${texto}%`;
      where.push(
        `(nombre LIKE ? OR codigo_interno LIKE ? OR codigo_barra LIKE ?
          OR id IN (SELECT producto_id FROM variantes WHERE sku LIKE ? OR codigo_barra LIKE ?))`,
      );
      args.push(like, like, like, like, like);
    }

    if (categoriaIds && categoriaIds.length > 0) {
      const placeholders = categoriaIds.map(() => '?').join(',');
      where.push(`categoria_id IN (${placeholders})`);
      args.push(...categoriaIds);
    }

    if (marcaIds && marcaIds.length > 0) {
      const placeholders = marcaIds.map(() => '?').join(',');
      where.push(`marca_id IN (${placeholders})`);
      args.push(...marcaIds);
    }

    // Pedimos un margen extra cuando filtramos por stock para compensar las
    // filas que se descartan después; mejor que paginar exacto y quedarte corto.
    const sqlLimit = soloConStock ? limit * 3 : limit;
    args.push(sqlLimit);

    const rows = await db.getAllAsync<ProductoRow>(
      `SELECT * FROM productos WHERE ${where.join(' AND ')} ORDER BY nombre LIMIT ?`,
      ...args,
    );

    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const stockRows = await db.getAllAsync<{ producto_id: string; total: number }>(
      `SELECT producto_id, SUM(cantidad) as total FROM stock_local
       WHERE ubicacion_id = ? AND producto_id IN (${placeholders})
       GROUP BY producto_id`,
      ubicacionId,
      ...ids,
    );
    const stockMap = new Map<string, number>();
    for (const s of stockRows) stockMap.set(s.producto_id, Number(s.total));

    const variantesRows = await db.getAllAsync<{ producto_id: string }>(
      `SELECT DISTINCT producto_id FROM variantes WHERE activo = 1 AND producto_id IN (${placeholders})`,
      ...ids,
    );
    const conVar = new Set(variantesRows.map((v) => v.producto_id));

    const resultado = rows.map((r) => {
      const producto = rowToProducto(r);
      return {
        producto,
        stockAgregado: stockMap.get(r.id) ?? 0,
        tieneVariantes: conVar.has(r.id) || producto.usaVariantes,
      };
    });

    if (soloConStock) {
      // Filtramos en memoria porque SUM(cantidad) puede ser 0 sin que el
      // producto deje de existir, y queremos que el catálogo del POS sólo
      // muestre lo que el cajero puede vender.
      return resultado.filter((p) => p.stockAgregado > 0).slice(0, limit);
    }
    return resultado.slice(0, limit);
  }

  async listarCategoriasUsadas(): Promise<{ id: string; nombre: string }[]> {
    const db = await this.getDb();
    return db.getAllAsync<{ id: string; nombre: string }>(
      `SELECT c.id, c.nombre FROM categorias c
       WHERE EXISTS (
         SELECT 1 FROM productos p WHERE p.categoria_id = c.id AND p.activo = 1
       )
       ORDER BY c.nombre`,
    );
  }

  async listarMarcasUsadas(): Promise<{ id: string; nombre: string }[]> {
    const db = await this.getDb();
    return db.getAllAsync<{ id: string; nombre: string }>(
      `SELECT m.id, m.nombre FROM marcas m
       WHERE EXISTS (
         SELECT 1 FROM productos p WHERE p.marca_id = m.id AND p.activo = 1
       )
       ORDER BY m.nombre`,
    );
  }

  async findProductoById(id: string): Promise<CatalogoProducto | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<ProductoRow>(`SELECT * FROM productos WHERE id = ?`, id);
    return row ? rowToProducto(row) : null;
  }

  async findVariantesByProducto(productoId: string): Promise<CatalogoVariante[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<VarianteRow>(
      `SELECT * FROM variantes WHERE producto_id = ? AND activo = 1 ORDER BY orden ASC`,
      productoId,
    );
    return rows.map(rowToVariante);
  }

  async findModelosByProducto(productoId: string): Promise<CatalogoModelo[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<ModeloRow>(
      `SELECT * FROM modelos WHERE producto_id = ? AND activo = 1 ORDER BY orden ASC`,
      productoId,
    );
    return rows.map(rowToModelo);
  }

  async findStockLocal(productoId: string, varianteId: string | null, ubicacionId: string): Promise<number> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ cantidad: number }>(
      `SELECT cantidad FROM stock_local WHERE producto_id = ? AND variante_id = ? AND ubicacion_id = ?`,
      productoId,
      varianteId ?? '',
      ubicacionId,
    );
    return row ? Number(row.cantidad) : 0;
  }

  async decrementStockLocal(
    productoId: string,
    varianteId: string | null,
    ubicacionId: string,
    cantidad: number,
  ): Promise<void> {
    const db = await this.getDb();
    const vid = varianteId ?? '';
    const existing = await db.getFirstAsync<{ cantidad: number }>(
      `SELECT cantidad FROM stock_local WHERE producto_id = ? AND variante_id = ? AND ubicacion_id = ?`,
      productoId,
      vid,
      ubicacionId,
    );
    if (existing) {
      await db.runAsync(
        `UPDATE stock_local SET cantidad = cantidad - ?, updated_at = ?
         WHERE producto_id = ? AND variante_id = ? AND ubicacion_id = ?`,
        cantidad,
        new Date().toISOString(),
        productoId,
        vid,
        ubicacionId,
      );
    } else {
      // No había fila → creamos una con cantidad negativa (permitir venta sin stock).
      await db.runAsync(
        `INSERT INTO stock_local (producto_id, variante_id, ubicacion_id, cantidad, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        productoId,
        vid,
        ubicacionId,
        -cantidad,
        new Date().toISOString(),
      );
    }
  }

  async lastSyncAt(): Promise<string | null> {
    return this.getMeta(KEY_LAST_SYNC);
  }

  async getConfig(): Promise<CatalogoConfig | null> {
    const raw = await this.getMeta(KEY_CONFIG);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CatalogoConfig;
    } catch {
      return null;
    }
  }

  private async getMeta(key: string): Promise<string | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ value: string | null }>(
      `SELECT value FROM sync_meta WHERE key = ?`,
      key,
    );
    return row?.value ?? null;
  }

  private async setMeta(key: string, value: string | null): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      `INSERT INTO sync_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      key,
      value,
    );
  }

  async aplicarSnapshot(snapshot: CatalogoSnapshot): Promise<void> {
    const db = await this.getDb();
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        DELETE FROM productos;
        DELETE FROM variantes;
        DELETE FROM modelos;
        DELETE FROM categorias;
        DELETE FROM marcas;
        DELETE FROM stock_local;
      `);
      await this.insertProductos(db, snapshot.productos);
      await this.insertVariantes(db, snapshot.variantes);
      await this.insertModelos(db, snapshot.modelos);
      await this.insertCategorias(db, snapshot.categorias);
      await this.insertMarcas(db, snapshot.marcas);
      await this.insertStock(db, snapshot.stock);
    });
    await this.setMeta(KEY_LAST_SYNC, snapshot.serverTime);
    await this.setMeta(KEY_CONFIG, JSON.stringify(snapshot.config));
  }

  async aplicarDiff(snapshot: CatalogoSnapshot): Promise<void> {
    const db = await this.getDb();
    await db.withTransactionAsync(async () => {
      await this.upsertProductos(db, snapshot.productos);
      await this.upsertVariantes(db, snapshot.variantes);
      await this.upsertModelos(db, snapshot.modelos);
      // Categorías/marcas vienen completas → reemplazo total.
      await db.execAsync(`DELETE FROM categorias; DELETE FROM marcas;`);
      await this.insertCategorias(db, snapshot.categorias);
      await this.insertMarcas(db, snapshot.marcas);
      await this.upsertStock(db, snapshot.stock);
    });
    await this.setMeta(KEY_LAST_SYNC, snapshot.serverTime);
    await this.setMeta(KEY_CONFIG, JSON.stringify(snapshot.config));
  }

  private async insertProductos(db: SQLite.SQLiteDatabase, productos: CatalogoProducto[]): Promise<void> {
    for (const p of productos) {
      await db.runAsync(
        `INSERT INTO productos (id, organization_id, categoria_id, marca_id, nombre, codigo_interno,
          codigo_barra, costo_neto, precio_venta_final, precio_venta_neto, precio_oferta, tipo, activo,
          usa_variantes, imagen_url, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        p.id,
        p.organizationId,
        p.categoriaId,
        p.marcaId,
        p.nombre,
        p.codigoInterno,
        p.codigoBarra,
        p.costoNeto,
        p.precioVentaFinal,
        p.precioVentaNeto,
        p.precioOferta,
        p.tipo,
        p.activo ? 1 : 0,
        p.usaVariantes ? 1 : 0,
        p.imagenUrl ?? null,
        p.updatedAt,
      );
    }
  }

  private async upsertProductos(db: SQLite.SQLiteDatabase, productos: CatalogoProducto[]): Promise<void> {
    for (const p of productos) {
      await db.runAsync(
        `INSERT INTO productos (id, organization_id, categoria_id, marca_id, nombre, codigo_interno,
          codigo_barra, costo_neto, precio_venta_final, precio_venta_neto, precio_oferta, tipo, activo,
          usa_variantes, imagen_url, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           organization_id = excluded.organization_id,
           categoria_id = excluded.categoria_id,
           marca_id = excluded.marca_id,
           nombre = excluded.nombre,
           codigo_interno = excluded.codigo_interno,
           codigo_barra = excluded.codigo_barra,
           costo_neto = excluded.costo_neto,
           precio_venta_final = excluded.precio_venta_final,
           precio_venta_neto = excluded.precio_venta_neto,
           precio_oferta = excluded.precio_oferta,
           tipo = excluded.tipo,
           activo = excluded.activo,
           usa_variantes = excluded.usa_variantes,
           imagen_url = excluded.imagen_url,
           updated_at = excluded.updated_at`,
        p.id,
        p.organizationId,
        p.categoriaId,
        p.marcaId,
        p.nombre,
        p.codigoInterno,
        p.codigoBarra,
        p.costoNeto,
        p.precioVentaFinal,
        p.precioVentaNeto,
        p.precioOferta,
        p.tipo,
        p.activo ? 1 : 0,
        p.usaVariantes ? 1 : 0,
        p.imagenUrl ?? null,
        p.updatedAt,
      );
    }
  }

  private async insertVariantes(db: SQLite.SQLiteDatabase, variantes: CatalogoVariante[]): Promise<void> {
    for (const v of variantes) {
      await db.runAsync(
        `INSERT INTO variantes (id, producto_id, modelo_id, talla, sku, codigo_barra,
          precio_venta_final, precio_venta_neto, costo_neto, activo, orden, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        v.id,
        v.productoId,
        v.modeloId,
        v.talla,
        v.sku,
        v.codigoBarra,
        v.precioVentaFinal,
        v.precioVentaNeto,
        v.costoNeto,
        v.activo ? 1 : 0,
        v.orden,
        v.updatedAt,
      );
    }
  }

  private async upsertVariantes(db: SQLite.SQLiteDatabase, variantes: CatalogoVariante[]): Promise<void> {
    for (const v of variantes) {
      await db.runAsync(
        `INSERT INTO variantes (id, producto_id, modelo_id, talla, sku, codigo_barra,
          precio_venta_final, precio_venta_neto, costo_neto, activo, orden, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           producto_id = excluded.producto_id,
           modelo_id = excluded.modelo_id,
           talla = excluded.talla,
           sku = excluded.sku,
           codigo_barra = excluded.codigo_barra,
           precio_venta_final = excluded.precio_venta_final,
           precio_venta_neto = excluded.precio_venta_neto,
           costo_neto = excluded.costo_neto,
           activo = excluded.activo,
           orden = excluded.orden,
           updated_at = excluded.updated_at`,
        v.id,
        v.productoId,
        v.modeloId,
        v.talla,
        v.sku,
        v.codigoBarra,
        v.precioVentaFinal,
        v.precioVentaNeto,
        v.costoNeto,
        v.activo ? 1 : 0,
        v.orden,
        v.updatedAt,
      );
    }
  }

  private async insertModelos(db: SQLite.SQLiteDatabase, modelos: CatalogoModelo[]): Promise<void> {
    for (const m of modelos) {
      await db.runAsync(
        `INSERT INTO modelos (id, producto_id, nombre, imagen_url, orden, activo, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        m.id,
        m.productoId,
        m.nombre,
        m.imagenUrl,
        m.orden,
        m.activo ? 1 : 0,
        m.updatedAt,
      );
    }
  }

  private async upsertModelos(db: SQLite.SQLiteDatabase, modelos: CatalogoModelo[]): Promise<void> {
    for (const m of modelos) {
      await db.runAsync(
        `INSERT INTO modelos (id, producto_id, nombre, imagen_url, orden, activo, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           producto_id = excluded.producto_id,
           nombre = excluded.nombre,
           imagen_url = excluded.imagen_url,
           orden = excluded.orden,
           activo = excluded.activo,
           updated_at = excluded.updated_at`,
        m.id,
        m.productoId,
        m.nombre,
        m.imagenUrl,
        m.orden,
        m.activo ? 1 : 0,
        m.updatedAt,
      );
    }
  }

  private async insertCategorias(
    db: SQLite.SQLiteDatabase,
    categorias: { id: string; nombre: string }[],
  ): Promise<void> {
    for (const c of categorias) {
      await db.runAsync(`INSERT INTO categorias (id, nombre) VALUES (?, ?)`, c.id, c.nombre);
    }
  }

  private async insertMarcas(
    db: SQLite.SQLiteDatabase,
    marcas: { id: string; nombre: string }[],
  ): Promise<void> {
    for (const m of marcas) {
      await db.runAsync(`INSERT INTO marcas (id, nombre) VALUES (?, ?)`, m.id, m.nombre);
    }
  }

  private async insertStock(
    db: SQLite.SQLiteDatabase,
    stock: { productoId: string; varianteId: string | null; ubicacionId: string; cantidad: number; updatedAt: string }[],
  ): Promise<void> {
    for (const s of stock) {
      await db.runAsync(
        `INSERT INTO stock_local (producto_id, variante_id, ubicacion_id, cantidad, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        s.productoId,
        s.varianteId ?? '',
        s.ubicacionId,
        s.cantidad,
        s.updatedAt,
      );
    }
  }

  private async upsertStock(
    db: SQLite.SQLiteDatabase,
    stock: { productoId: string; varianteId: string | null; ubicacionId: string; cantidad: number; updatedAt: string }[],
  ): Promise<void> {
    for (const s of stock) {
      await db.runAsync(
        `INSERT INTO stock_local (producto_id, variante_id, ubicacion_id, cantidad, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(producto_id, variante_id, ubicacion_id) DO UPDATE SET
           cantidad = excluded.cantidad,
           updated_at = excluded.updated_at`,
        s.productoId,
        s.varianteId ?? '',
        s.ubicacionId,
        s.cantidad,
        s.updatedAt,
      );
    }
  }

  async isEmpty(): Promise<boolean> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) as c FROM productos`);
    return (row?.c ?? 0) === 0;
  }

  async setUbicacionId(ubicacionId: string): Promise<void> {
    await this.setMeta(KEY_UBICACION, ubicacionId);
  }

  async getUbicacionId(): Promise<string | null> {
    return this.getMeta(KEY_UBICACION);
  }
}
