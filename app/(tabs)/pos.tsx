import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import { colors, radius, spacing, type } from '../../src/runtime/theme/tokens';
import { container } from '../../src/runtime/di/container';
import { useSesionStore } from '../../src/runtime/stores/SesionStore';
import { useCarritoStore } from '../../src/runtime/stores/CarritoStore';
import {
  useCatalogoSyncStore,
  diasDesdeUltimaSync,
} from '../../src/runtime/stores/CatalogoSyncStore';
import { useOfflineQueueStore } from '../../src/runtime/stores/OfflineQueueStore';
import { trySyncCatalogo } from '../../src/runtime/catalogo/CatalogoSyncManager';
import { executeOrEnqueue } from '../../src/runtime/offline/OfflineQueueManager';
import { formatCLP } from '../../src/runtime/utils/formato';
import { ScannerModal } from '../../src/runtime/components/ScannerModal';
import { CobroModal } from '../../src/runtime/components/CobroModal';
import { SelectorVarianteModal } from '../../src/runtime/components/SelectorVarianteModal';
import { ClienteModal, type ClienteResuelto } from '../../src/runtime/components/ClienteModal';
import { Producto } from '../../src/contexts/producto/domain/Producto';
import type { Modelo, Variante } from '../../src/contexts/producto/domain/Variante';
import type { Ubicacion } from '../../src/contexts/ubicacion/domain/Ubicacion';
import { DomainError } from '../../src/contexts/shared/domain/DomainError';
import type { VarianteInfo } from '../../src/contexts/venta/domain/ItemCarrito';
import type { MedioPago } from '../../src/contexts/venta/domain/MedioPago';
import type { CatalogoProducto } from '../../src/contexts/catalogo-local/domain/CatalogoSnapshot';

const claveDe = (productoId: string, varianteId: string | null): string =>
  varianteId ? `${productoId}:${varianteId}` : `${productoId}::`;

/** Adapta CatalogoProducto → Producto (clase de dominio usada por el carrito). */
function toProducto(p: CatalogoProducto): Producto {
  return Producto.create({
    id: p.id,
    nombre: p.nombre,
    codigoBarras: p.codigoBarra,
    sku: p.codigoInterno,
    precioVentaFinalUnitario: p.precioVentaFinal,
    precioOferta: p.precioOferta,
    imagenUrl: null,
    activo: p.activo,
  });
}

interface ProductoVista {
  producto: Producto;
  raw: CatalogoProducto;
  stockAgregado: number;
  tieneVariantes: boolean;
}

interface TicketInfo {
  nroOrden: string;
  clientVentaId: string;
  pendiente: boolean;
  vuelto: number | null;
  clienteMostrado: string | null;
}

export default function PosScreen() {
  const sesion = useSesionStore((s) => s.sesion);
  const negocio = useSesionStore((s) => s.negocio);
  const { carrito, version, agregar, quitar, setCantidad, vaciar } = useCarritoStore();

  const catalogoEmpty = useCatalogoSyncStore((s) => s.empty);
  const catalogoSyncing = useCatalogoSyncStore((s) => s.syncing);
  const lastSyncAt = useCatalogoSyncStore((s) => s.lastSyncAt);
  const catalogoError = useCatalogoSyncStore((s) => s.error);
  const diasSinSync = diasDesdeUltimaSync(lastSyncAt);
  const online = useOfflineQueueStore((s) => s.online) !== false;

  const [query, setQuery] = useState('');
  const [productos, setProductos] = useState<ProductoVista[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [cobroVisible, setCobroVisible] = useState(false);
  const [clienteModalVisible, setClienteModalVisible] = useState(false);
  const [clienteResuelto, setClienteResuelto] = useState<ClienteResuelto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ultimoTicket, setUltimoTicket] = useState<TicketInfo | null>(null);
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [ubicacionManualId, setUbicacionManualId] = useState<string | null>(null);
  const [cargandoUbicaciones, setCargandoUbicaciones] = useState(false);
  const [vista, setVista] = useState<'carrito' | 'catalogo'>('carrito');
  const [selectorProducto, setSelectorProducto] = useState<Producto | null>(null);
  const [selectorRaw, setSelectorRaw] = useState<CatalogoProducto | null>(null);
  /** Stock por variante (clave = varianteId). Se refresca junto al catálogo visible. */
  const [stockPorVariante, setStockPorVariante] = useState<Map<string, number>>(new Map());
  /** Mapa productoId → stock agregado, calculado de resultados. */
  const [stockPorProducto, setStockPorProducto] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    vaciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const esVendedor = negocio?.rol === 'VENDEDOR';
  const ubicacionId = esVendedor ? negocio?.ubicacionId ?? null : ubicacionManualId;
  const puedeVender = !!ubicacionId && !catalogoEmpty;

  useEffect(() => {
    if (!sesion || !negocio || esVendedor) return;
    setCargandoUbicaciones(true);
    container.listarUbicaciones
      .execute({ negocioId: negocio.id, token: sesion.token })
      .then((res) => {
        setUbicaciones(res);
        if (!ubicacionManualId && res.length > 0) {
          const principal = res.find((u) => u.esPrincipal) ?? res[0];
          setUbicacionManualId(principal.id);
        }
      })
      .catch(() => setError('No pudimos traer las ubicaciones del negocio'))
      .finally(() => setCargandoUbicaciones(false));
  }, [sesion, negocio, esVendedor, ubicacionManualId]);

  const ubicacionActual = esVendedor
    ? negocio?.ubicacionNombre ?? null
    : ubicaciones.find((u) => u.id === ubicacionManualId)?.nombre ?? null;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Trae productos del catálogo local + stock variante para los que matchean. */
  const fetchProductos = useCallback(
    async (texto: string) => {
      if (!ubicacionId) return;
      setBuscando(true);
      setError(null);
      try {
        const items = await container.catalogoLocalRepo.buscarProductos({
          q: texto,
          ubicacionId,
          limit: 50,
        });
        const vistas: ProductoVista[] = items.map((i) => ({
          producto: toProducto(i.producto),
          raw: i.producto,
          stockAgregado: i.stockAgregado,
          tieneVariantes: i.tieneVariantes,
        }));
        setProductos(vistas);

        // Cargo stock por variante para los productos con variantes (solo los visibles).
        const prodMap = new Map<string, number>();
        const varMap = new Map<string, number>();
        for (const v of vistas) {
          prodMap.set(v.producto.id, v.stockAgregado);
          if (v.tieneVariantes) {
            const vs = await container.catalogoLocalRepo.findVariantesByProducto(v.producto.id);
            for (const vr of vs) {
              const stk = await container.catalogoLocalRepo.findStockLocal(
                v.producto.id,
                vr.id,
                ubicacionId,
              );
              varMap.set(vr.id, stk);
            }
          }
        }
        setStockPorProducto(prodMap);
        setStockPorVariante(varMap);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar productos');
      } finally {
        setBuscando(false);
      }
    },
    [ubicacionId],
  );

  useEffect(() => {
    if (puedeVender) fetchProductos('');
  }, [puedeVender, ubicacionId, fetchProductos]);

  // Refresca stock tras sync (el store cambia lastSyncAt cuando hay nuevo snapshot).
  useEffect(() => {
    if (puedeVender) fetchProductos(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSyncAt]);

  // Al entrar al POS intentamos sincronizar si hay red (background refresh).
  useEffect(() => {
    if (online) void trySyncCatalogo();
  }, [online]);

  const stockDeProducto = useCallback(
    (productoId: string) => stockPorProducto.get(productoId) ?? 0,
    [stockPorProducto],
  );
  const stockDeVariante = useCallback(
    (varianteId: string) => stockPorVariante.get(varianteId) ?? 0,
    [stockPorVariante],
  );

  const cantidadEnCarritoMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of carrito.items) map.set(it.clave, it.cantidad);
    return map;
  }, [carrito, version]);

  const cantidadEnCarritoPorProducto = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of carrito.items) {
      map.set(it.producto.id, (map.get(it.producto.id) ?? 0) + it.cantidad);
    }
    return map;
  }, [carrito, version]);

  const onQueryChange = (t: string) => {
    setQuery(t);
    if (t.trim().length > 0) setVista('catalogo');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchProductos(t), 200);
  };

  /** Provider offline-first del SelectorVarianteModal. */
  const selectorProvider = useCallback(
    async (productoId: string): Promise<{ variantes: Variante[]; modelos: Modelo[] }> => {
      const vs = await container.catalogoLocalRepo.findVariantesByProducto(productoId);
      const ms = await container.catalogoLocalRepo.findModelosByProducto(productoId);
      const variantes: Variante[] = vs.map((v) => ({
        id: v.id,
        productoId: v.productoId,
        modeloId: v.modeloId,
        talla: v.talla,
        sku: v.sku,
        codigoBarra: v.codigoBarra,
        costoNeto: v.costoNeto,
        precioVentaFinal: v.precioVentaFinal,
        precioVentaNeto: v.precioVentaNeto,
        orden: v.orden,
        activo: v.activo,
      }));
      const modelos: Modelo[] = ms.map((m) => ({
        id: m.id,
        nombre: m.nombre,
        imagenUrl: m.imagenUrl,
        orden: m.orden,
        activo: m.activo,
      }));
      return { variantes, modelos };
    },
    [],
  );

  const abrirProducto = useCallback(
    async (v: ProductoVista) => {
      if (v.tieneVariantes) {
        setSelectorProducto(v.producto);
        setSelectorRaw(v.raw);
        return;
      }
      handleAgregar(v.producto, null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleAgregar = (p: Producto, variante: VarianteInfo | null) => {
    // Con `permitirVentaSinStock` (default true acá), no bloqueamos por stock.
    // Pero sí avisamos visualmente si quedaría negativo.
    setError(null);
    agregar(p, 1, variante);
    Keyboard.dismiss();
  };

  const handleIncrementar = (productoId: string, varianteId: string | null) => {
    const clave = claveDe(productoId, varianteId);
    const enCarrito = cantidadEnCarritoMap.get(clave) ?? 0;
    setError(null);
    setCantidad(productoId, enCarrito + 1, varianteId);
  };

  const handleDecrementar = (productoId: string, varianteId: string | null) => {
    const clave = claveDe(productoId, varianteId);
    const enCarrito = cantidadEnCarritoMap.get(clave) ?? 0;
    if (enCarrito <= 1) {
      quitar(productoId, varianteId);
    } else {
      setCantidad(productoId, enCarrito - 1, varianteId);
    }
    setError(null);
  };

  const handleScan = async (codigo: string) => {
    setScannerVisible(false);
    if (!ubicacionId) return;
    setBuscando(true);
    setError(null);
    try {
      const items = await container.catalogoLocalRepo.buscarProductos({
        q: codigo,
        ubicacionId,
        limit: 10,
      });
      const exacto = items.find((i) => i.producto.codigoBarra === codigo) ?? items[0];
      if (exacto) {
        const vistas: ProductoVista = {
          producto: toProducto(exacto.producto),
          raw: exacto.producto,
          stockAgregado: exacto.stockAgregado,
          tieneVariantes: exacto.tieneVariantes,
        };
        await abrirProducto(vistas);
        setQuery('');
        fetchProductos('');
      } else {
        setError(`No se encontró producto con código ${codigo}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al buscar');
    } finally {
      setBuscando(false);
    }
  };

  const cobrar = async (args: { medioPago: MedioPago; montoRecibido?: number }) => {
    if (!sesion || !negocio || !ubicacionId) return;
    try {
      const clienteFields =
        clienteResuelto?.tipo === 'customerId'
          ? { customerId: clienteResuelto.customerId }
          : clienteResuelto?.tipo === 'clienteData'
            ? { clienteData: clienteResuelto.data }
            : {};

      const items = carrito.items.map((i) => ({
        productoId: i.producto.id,
        cantidad: i.cantidad,
        ...(i.variante ? { varianteId: i.variante.id } : {}),
      }));

      const clientVentaId = Crypto.randomUUID();
      const payload: Record<string, unknown> = {
        ubicacionId,
        medioPago: args.medioPago,
        canal: 'PRESENCIAL',
        items,
        ...(args.montoRecibido !== undefined && { montoRecibido: args.montoRecibido }),
        ...clienteFields,
      };

      // Calculo vuelto localmente (para mostrarlo aunque se haya encolado).
      const vuelto =
        args.montoRecibido !== undefined && args.montoRecibido > carrito.subtotal
          ? args.montoRecibido - carrito.subtotal
          : null;
      const clienteMostrado =
        clienteResuelto && clienteResuelto.tipo !== 'skip'
          ? clienteResuelto.nombreMostrado
          : null;

      const { executedOnline, id } = await executeOrEnqueue({
        type: 'VENTA_PRESENCIAL',
        negocioId: negocio.id,
        payload: { ...payload, clientVentaId },
        label: `Venta presencial #${clientVentaId.slice(0, 8)}`,
      });

      // Mutación optimista del stock local — siempre, ya que la venta queda
      // asentada en el servidor antes o después.
      for (const it of carrito.items) {
        await container.catalogoLocalRepo.decrementStockLocal(
          it.producto.id,
          it.variante?.id ?? null,
          ubicacionId,
          it.cantidad,
        );
      }

      setUltimoTicket({
        nroOrden: executedOnline ? id.slice(0, 8) : clientVentaId.slice(0, 8),
        clientVentaId,
        pendiente: !executedOnline,
        vuelto,
        clienteMostrado,
      });
      vaciar();
      setCobroVisible(false);
      setClienteResuelto(null);
      setVista('carrito');
      // Refresca la lista visible con el stock ya mutado.
      fetchProductos(query);
    } catch (e) {
      // Errores 4xx del backend (validación) → burbujean al CobroModal.
      throw e instanceof DomainError || e instanceof Error ? e : new Error('Error desconocido');
    }
  };

  const handleClienteResuelto = (r: ClienteResuelto) => {
    setClienteModalVisible(false);
    setClienteResuelto(r.tipo === 'skip' ? null : r);
    setCobroVisible(true);
  };

  // === Renders ===

  // Bloqueo total si nunca se sincronizó.
  if (catalogoEmpty) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.blockedBox}>
          <Text style={styles.blockedTitle}>Catálogo no disponible</Text>
          <Text style={styles.blockedBody}>
            Para empezar a vender necesitás descargar el catálogo de este negocio al menos una vez
            con conexión.
          </Text>
          {catalogoError && <Text style={styles.error}>{catalogoError}</Text>}
          <Pressable
            style={[styles.cobrar, catalogoSyncing && styles.cobrarDisabled]}
            disabled={catalogoSyncing}
            onPress={() => void trySyncCatalogo({ forceFull: true })}
          >
            <Text style={styles.cobrarText}>
              {catalogoSyncing ? 'SINCRONIZANDO...' : 'SINCRONIZAR CATÁLOGO'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {diasSinSync !== null && diasSinSync > 7 && (
        <View style={styles.warningOld}>
          <Text style={styles.warningOldText}>
            Catálogo sin actualizar hace {diasSinSync} días — conectate para sincronizar
          </Text>
        </View>
      )}

      <View style={styles.header}>
        <Text style={styles.titleSmall}>POS · {negocio?.nombre}</Text>
        <Text style={styles.sub}>
          {ubicacionActual ?? (esVendedor ? 'Sin ubicación asignada' : 'Sin ubicaciones en el negocio')}
        </Text>
      </View>

      {!esVendedor && ubicaciones.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsRow}
          contentContainerStyle={styles.chipsContent}
        >
          {ubicaciones.map((u) => {
            const activo = u.id === ubicacionManualId;
            return (
              <Pressable
                key={u.id}
                style={[styles.chip, activo && styles.chipActivo]}
                onPress={() => setUbicacionManualId(u.id)}
              >
                <Text style={[styles.chipText, activo && styles.chipTextActivo]}>
                  {u.nombre} · {u.tipo === 'SUCURSAL' ? 'Sucursal' : 'Bodega'}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {!puedeVender && !cargandoUbicaciones && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            {esVendedor
              ? 'No tenés una ubicación asignada. Pedile a un administrador que te asigne una sucursal para poder vender.'
              : 'Este negocio todavía no tiene ubicaciones creadas. Creá una sucursal o bodega desde el panel de administración para empezar a vender.'}
          </Text>
        </View>
      )}

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder="Buscar por nombre, SKU o código..."
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          autoCorrect={false}
          editable={puedeVender}
          onFocus={() => setVista('catalogo')}
        />
        <Pressable
          style={[styles.scanBtn, !puedeVender && { opacity: 0.4 }]}
          onPress={() => {
            setVista('catalogo');
            setScannerVisible(true);
          }}
          disabled={!puedeVender}
        >
          <Text style={styles.scanText}>ESCANEAR</Text>
        </Pressable>
      </View>

      <View style={styles.vistaToggle}>
        <Pressable
          style={[styles.toggleBtn, vista === 'carrito' && styles.toggleBtnActivo]}
          onPress={() => setVista('carrito')}
        >
          <Text style={[styles.toggleText, vista === 'carrito' && styles.toggleTextActivo]}>
            Carrito ({carrito.cantidadItems})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggleBtn, vista === 'catalogo' && styles.toggleBtnActivo]}
          onPress={() => setVista('catalogo')}
          disabled={!puedeVender}
        >
          <Text style={[styles.toggleText, vista === 'catalogo' && styles.toggleTextActivo]}>
            Ver todo
          </Text>
        </Pressable>
        {buscando && <ActivityIndicator color={colors.accent} style={{ marginLeft: spacing.sm }} />}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {ultimoTicket && vista === 'carrito' && (
        <View style={ultimoTicket.pendiente ? styles.ticketPendiente : styles.ticketOk}>
          {ultimoTicket.pendiente && (
            <Text style={styles.ticketBadge}>COPIA TEMPORAL — se confirmará al recuperar conexión</Text>
          )}
          <Text style={styles.ticketTitulo}>
            {ultimoTicket.pendiente ? 'Venta encolada ' : 'Venta #'}
            {ultimoTicket.pendiente ? `(${ultimoTicket.clientVentaId.slice(0, 8)})` : ultimoTicket.nroOrden}
          </Text>
          {ultimoTicket.vuelto !== null && (
            <Text style={styles.ticketLinea}>Vuelto: {formatCLP(ultimoTicket.vuelto)}</Text>
          )}
          {ultimoTicket.clienteMostrado && (
            <Text style={styles.ticketLinea}>Cliente: {ultimoTicket.clienteMostrado}</Text>
          )}
        </View>
      )}

      {vista === 'catalogo' ? (
        <FlatList
          data={productos}
          keyExtractor={(p) => p.producto.id}
          style={styles.catalog}
          contentContainerStyle={productos.length === 0 ? styles.empty : { paddingBottom: spacing.xl }}
          ListEmptyComponent={
            !buscando && puedeVender ? (
              <Text style={styles.emptyText}>
                {query.trim() ? 'Sin resultados para esa búsqueda.' : 'No hay productos en el catálogo.'}
              </Text>
            ) : null
          }
          renderItem={({ item }) => {
            const tieneVariantes = item.tieneVariantes;
            const disponible = item.stockAgregado;
            return (
              <View style={styles.prodRow}>
                <Pressable
                  onPress={() => abrirProducto(item)}
                  style={styles.prodMain}
                  disabled={!puedeVender}
                >
                  <View style={[styles.prodThumb, styles.prodThumbPlaceholder]}>
                    <Text style={styles.prodThumbPlaceholderText}>
                      {item.producto.nombre.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.prodTextBlock}>
                    <Text style={styles.prodNombre} numberOfLines={1}>
                      {item.producto.nombre}
                    </Text>
                    <Text style={styles.prodMeta} numberOfLines={1}>
                      {item.producto.sku
                        ? `SKU ${item.producto.sku}`
                        : item.producto.codigoBarras
                          ? `CB ${item.producto.codigoBarras}`
                          : '—'}
                      {` · Stock ${disponible}`}
                      {tieneVariantes ? ' · Variantes' : ''}
                    </Text>
                  </View>
                </Pressable>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={styles.prodPrecio}>{formatCLP(item.producto.precio)}</Text>
                  <Pressable
                    style={[styles.addBtn, !puedeVender && styles.addBtnDisabled]}
                    disabled={!puedeVender}
                    onPress={() => abrirProducto(item)}
                  >
                    <Text style={styles.addBtnText}>{tieneVariantes ? 'Elegir' : 'Agregar'}</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      ) : (
        <FlatList
          key={version}
          data={carrito.items as any}
          keyExtractor={(i) => i.clave}
          style={styles.catalog}
          contentContainerStyle={carrito.vacio ? styles.empty : { paddingBottom: spacing.xl }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingHorizontal: spacing.xl }}>
              <Text style={styles.emptyText}>
                Tu carrito está vacío. Presioná{' '}
                <Text style={{ color: colors.accent, fontWeight: '700' }}>Ver todo</Text>, escaneá un código o buscá un producto para empezar.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const varianteId = item.variante?.id ?? null;
            const disponible = varianteId ? stockDeVariante(varianteId) : stockDeProducto(item.producto.id);
            return (
              <View style={styles.itemRow}>
                {item.producto.imagenUrl ? (
                  <Image source={{ uri: item.producto.imagenUrl }} style={styles.itemThumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.itemThumb, styles.prodThumbPlaceholder]}>
                    <Text style={styles.prodThumbPlaceholderText}>
                      {item.producto.nombre.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemNombre} numberOfLines={1}>{item.producto.nombre}</Text>
                  {item.varianteLabel && (
                    <Text style={styles.itemVariante} numberOfLines={1}>{item.varianteLabel}</Text>
                  )}
                  <Text style={styles.itemMeta}>{formatCLP(item.precioUnitario)} c/u · Stock {disponible}</Text>
                </View>
                <View style={styles.qtyRow}>
                  <Pressable style={styles.qtyBtn} onPress={() => handleDecrementar(item.producto.id, varianteId)}>
                    <Text style={styles.qtyBtnText}>–</Text>
                  </Pressable>
                  <Text style={styles.qtyText}>{item.cantidad}</Text>
                  <Pressable
                    style={styles.qtyBtn}
                    onPress={() => handleIncrementar(item.producto.id, varianteId)}
                  >
                    <Text style={styles.qtyBtnText}>+</Text>
                  </Pressable>
                  <Pressable style={styles.qtyBtn} onPress={() => quitar(item.producto.id, varianteId)}>
                    <Text style={styles.qtyBtnText}>🗑</Text>
                  </Pressable>
                </View>
                <Text style={styles.itemSubtotal}>{formatCLP(item.subtotal)}</Text>
              </View>
            );
          }}
        />
      )}

      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>
            Carrito · {carrito.cantidadItems} {carrito.cantidadItems === 1 ? 'item' : 'items'}
          </Text>
          <Text style={styles.total}>{formatCLP(carrito.subtotal)}</Text>
        </View>
        {!carrito.vacio && (
          <Pressable style={styles.clearBtn} onPress={vaciar}>
            <Text style={styles.clearBtnText}>Vaciar</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.cobrar, (carrito.vacio || !puedeVender) && styles.cobrarDisabled]}
          disabled={carrito.vacio || !puedeVender}
          onPress={() => {
            setError(null);
            setUltimoTicket(null);
            setClienteResuelto(null);
            setClienteModalVisible(true);
          }}
        >
          <Text style={styles.cobrarText}>COBRAR</Text>
        </Pressable>
      </View>

      <ScannerModal visible={scannerVisible} onClose={() => setScannerVisible(false)} onScan={handleScan} />
      {sesion && negocio && (
        <ClienteModal
          visible={clienteModalVisible}
          negocioId={negocio.id}
          token={sesion.token}
          onClose={() => setClienteModalVisible(false)}
          onResuelto={handleClienteResuelto}
        />
      )}
      <CobroModal
        visible={cobroVisible}
        carrito={carrito}
        onClose={() => setCobroVisible(false)}
        onConfirmar={cobrar}
      />
      {sesion && negocio && (
        <SelectorVarianteModal
          visible={selectorProducto !== null}
          producto={selectorProducto}
          negocioId={negocio.id}
          token={sesion.token}
          stockPorVariante={stockPorVariante}
          provider={selectorProvider}
          bloquearSinStock={false}
          onClose={() => {
            setSelectorProducto(null);
            setSelectorRaw(null);
          }}
          onSeleccionar={(p, variante) => {
            setSelectorProducto(null);
            setSelectorRaw(null);
            handleAgregar(p, variante);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  titleSmall: { ...type.title, color: colors.text },
  sub: { ...type.body, color: colors.textMuted },
  warning: {
    margin: spacing.lg,
    padding: spacing.md,
    backgroundColor: '#3A2515',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accentDark,
  },
  warningText: { color: colors.accent, ...type.body },
  warningOld: {
    backgroundColor: colors.accentDark,
    padding: spacing.sm,
    alignItems: 'center',
  },
  warningOldText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  blockedBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  blockedTitle: { ...type.display, color: colors.text, textAlign: 'center' },
  blockedBody: { ...type.body, color: colors.textMuted, textAlign: 'center' },
  ticketOk: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  ticketPendiente: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#3A2515',
    borderWidth: 2,
    borderColor: colors.accent,
  },
  ticketBadge: {
    color: colors.accent,
    fontWeight: '800',
    fontSize: 12,
    marginBottom: spacing.xs,
    letterSpacing: 1,
  },
  ticketTitulo: { color: colors.text, ...type.body, fontWeight: '700' },
  ticketLinea: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  chipsRow: { maxHeight: 48, marginTop: spacing.md },
  chipsContent: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipActivo: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, ...type.body },
  chipTextActivo: { color: '#000', fontWeight: '700' },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  search: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    ...type.body,
  },
  scanBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  scanText: { color: '#000', ...type.label },
  error: {
    color: colors.danger,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    ...type.body,
  },
  vistaToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  toggleBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  toggleBtnActivo: { backgroundColor: colors.accent, borderColor: colors.accent },
  toggleText: { color: colors.text, ...type.label },
  toggleTextActivo: { color: '#000', fontWeight: '700' },
  label: { ...type.label, color: colors.textMuted },
  catalog: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textMuted, ...type.body, paddingHorizontal: spacing.xl, textAlign: 'center' },
  prodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  prodMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  prodThumb: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  prodThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  prodThumbPlaceholderText: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: '700',
  },
  prodTextBlock: { flex: 1, minWidth: 0 },
  itemThumb: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  prodNombre: { color: colors.text, ...type.body, fontWeight: '600' },
  prodMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  prodPrecio: { color: colors.accent, ...type.body, fontWeight: '700' },
  addBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
  addBtnDisabled: { backgroundColor: colors.border },
  addBtnText: { color: '#000', ...type.label, fontWeight: '700' },
  clearBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    marginRight: spacing.sm,
  },
  clearBtnText: { color: colors.danger, ...type.label, fontWeight: '700' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  itemNombre: { color: colors.text, ...type.body },
  itemVariante: { color: colors.accent, fontSize: 12, marginTop: 2, fontWeight: '600' },
  itemMeta: { color: colors.textMuted, fontSize: 12 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qtyBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qtyBtnText: { color: colors.text, fontSize: 18, fontWeight: '700' },
  qtyText: { color: colors.text, ...type.body, minWidth: 24, textAlign: 'center' },
  itemSubtotal: { color: colors.text, ...type.body, fontWeight: '700', minWidth: 80, textAlign: 'right' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  total: { ...type.display, color: colors.accent },
  cobrar: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
  },
  cobrarDisabled: { opacity: 0.4 },
  cobrarText: { color: '#000', ...type.title, letterSpacing: 1 },
});
