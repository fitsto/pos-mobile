import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, type } from '../../src/runtime/theme/tokens';
import { container } from '../../src/runtime/di/container';
import { useSesionStore } from '../../src/runtime/stores/SesionStore';
import { formatCLP } from '../../src/runtime/utils/formato';
import { ScannerModal } from '../../src/runtime/components/ScannerModal';
import { SelectorVarianteModal } from '../../src/runtime/components/SelectorVarianteModal';
import type { Producto } from '../../src/contexts/producto/domain/Producto';
import type { Ubicacion } from '../../src/contexts/ubicacion/domain/Ubicacion';
import type { VarianteInfo } from '../../src/contexts/venta/domain/ItemCarrito';
import {
  etiquetaMotivo,
  MOTIVOS_AJUSTE,
  MotivoAjuste,
} from '../../src/contexts/ajuste-inventario/domain/MotivoAjuste';
import { executeOrEnqueue } from '../../src/runtime/offline/OfflineQueueManager';
import { useOfflineQueueStore } from '../../src/runtime/stores/OfflineQueueStore';
import { OfflineBanner } from '../../src/runtime/components/OfflineBanner';

interface StockRowUI {
  producto: Producto;
  cantidad: number;
  varianteId: string | null;
  varianteTalla: string | null;
  modeloNombre: string | null;
}

/** Etiqueta corta "Modelo · Talla" para una fila de stock o una variante ya elegida. */
function varianteLabel(modelo: string | null, talla: string | null): string | null {
  const parts: string[] = [];
  if (modelo) parts.push(modelo);
  if (talla) parts.push(talla);
  return parts.length ? parts.join(' · ') : null;
}

export default function StockScreen() {
  const sesion = useSesionStore((s) => s.sesion);
  const negocio = useSesionStore((s) => s.negocio);
  const esVendedor = negocio?.rol === 'VENDEDOR';

  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [ubicacionId, setUbicacionId] = useState<string | null>(
    esVendedor ? (negocio?.ubicacionId ?? null) : null,
  );
  const ubicacionNombre = useMemo(() => {
    if (esVendedor) return negocio?.ubicacionNombre ?? null;
    return ubicaciones.find((u) => u.id === ubicacionId)?.nombre ?? null;
  }, [esVendedor, negocio, ubicaciones, ubicacionId]);

  useEffect(() => {
    if (!sesion || !negocio || esVendedor) return;
    let cancel = false;
    (async () => {
      try {
        const list = await container.listarUbicaciones.execute({
          negocioId: negocio.id,
          token: sesion.token,
        });
        if (cancel) return;
        setUbicaciones(list);
        if (!ubicacionId && list.length > 0) setUbicacionId(list[0].id);
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : 'Error al cargar ubicaciones');
      }
    })();
    return () => { cancel = true; };
  }, [sesion, negocio, esVendedor]);

  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<Producto[]>([]);
  const [seleccionado, setSeleccionado] = useState<Producto | null>(null);
  const [varianteSeleccionada, setVarianteSeleccionada] = useState<VarianteInfo | null>(null);
  const [selectorVisible, setSelectorVisible] = useState(false);
  /** Productos (ids) que ya sabemos tienen variantes por aparecer en el stock de la ubicación. */
  const [productosConVariantes, setProductosConVariantes] = useState<Set<string>>(new Set());
  const [resolviendoProducto, setResolviendoProducto] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState('');
  const [signo, setSigno] = useState<'+' | '-'>('-');
  const [motivo, setMotivo] = useState<MotivoAjuste>(MotivoAjuste.MERMA);
  const [comentario, setComentario] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const [stockItems, setStockItems] = useState<StockRowUI[]>([]);
  const [cargandoStock, setCargandoStock] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const puede = negocio?.puedeGestionarStock ?? false;

  const cargarStock = async () => {
    if (!sesion || !negocio || !ubicacionId) { setStockItems([]); return; }
    setCargandoStock(true);
    try {
      const [stocks, productos] = await Promise.all([
        container.listarStockPorUbicacion.execute({
          negocioId: negocio.id,
          ubicacionId,
          token: sesion.token,
        }),
        container.buscarProducto.execute({
          negocioId: negocio.id,
          query: '',
          ubicacionId,
          token: sesion.token,
        }),
      ]);
      const byId = new Map(productos.map((p) => [p.id, p]));
      const conVar = new Set<string>();
      const items: StockRowUI[] = stocks
        .map((s): StockRowUI | null => {
          const producto = byId.get(s.productoId);
          if (!producto) return null;
          if (s.varianteId) conVar.add(s.productoId);
          return {
            producto,
            cantidad: s.cantidad,
            varianteId: s.varianteId,
            varianteTalla: s.varianteTalla,
            modeloNombre: s.modeloNombre,
          };
        })
        .filter((x): x is StockRowUI => x !== null)
        .sort((a, b) => {
          const byName = a.producto.nombre.localeCompare(b.producto.nombre);
          if (byName !== 0) return byName;
          return (a.modeloNombre ?? '').localeCompare(b.modeloNombre ?? '') ||
            (a.varianteTalla ?? '').localeCompare(b.varianteTalla ?? '');
        });
      setStockItems(items);
      setProductosConVariantes(conVar);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar stock');
    } finally {
      setCargandoStock(false);
    }
  };

  useEffect(() => {
    cargarStock();
    // Intencional: cargarStock se recrea en cada render y no queremos re-disparar
    // por su identidad; las dependencias reales (sesión/negocio/ubicación) ya están listadas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ubicacionId, sesion, negocio]);

  // Auto-dismiss del banner de éxito tras 3s.
  useEffect(() => {
    if (!exito) return;
    const t = setTimeout(() => setExito(null), 3000);
    return () => clearTimeout(t);
  }, [exito]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await cargarStock();
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ubicacionId, sesion, negocio]);

  const buscar = async (texto: string) => {
    if (!sesion || !negocio || !texto.trim()) { setResultados([]); return; }
    setBuscando(true);
    try {
      const items = await container.buscarProducto.execute({
        negocioId: negocio.id,
        query: texto,
        token: sesion.token,
      });
      setResultados(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al buscar');
    } finally { setBuscando(false); }
  };

  /** Centraliza la elección de producto: si tiene variantes, abre selector; si no, lo fija. */
  const elegirProducto = async (p: Producto) => {
    setResultados([]);
    setQuery('');
    if (!sesion || !negocio) return;
    if (productosConVariantes.has(p.id)) {
      setSeleccionado(p);
      setVarianteSeleccionada(null);
      setSelectorVisible(true);
      return;
    }
    // Consulta ligera para detectar variantes no reflejadas en el stock.
    setResolviendoProducto(p.id);
    try {
      const { variantes } = await container.listarVariantes.execute({
        negocioId: negocio.id,
        productoId: p.id,
        token: sesion.token,
      });
      if (variantes.length === 0) {
        setSeleccionado(p);
        setVarianteSeleccionada(null);
      } else {
        setSeleccionado(p);
        setVarianteSeleccionada(null);
        setSelectorVisible(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos cargar las variantes');
    } finally {
      setResolviendoProducto(null);
    }
  };

  const elegirFilaStock = (row: StockRowUI) => {
    setResultados([]);
    setQuery('');
    setSeleccionado(row.producto);
    if (row.varianteId) {
      setVarianteSeleccionada({
        id: row.varianteId,
        modeloNombre: row.modeloNombre,
        talla: row.varianteTalla,
        precioVentaFinal: null,
      });
      setSelectorVisible(false);
    } else {
      setVarianteSeleccionada(null);
    }
  };

  const onScan = async (codigo: string) => {
    setScannerVisible(false);
    if (!sesion || !negocio) return;
    try {
      const items = await container.buscarProducto.execute({
        negocioId: negocio.id,
        query: codigo,
        token: sesion.token,
      });
      const exacto = items.find((p) => p.codigoBarras === codigo) ?? items[0];
      if (exacto) {
        await elegirProducto(exacto);
      } else {
        setError(`No se encontró producto con código ${codigo}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al buscar');
    }
  };

  const tieneVariantesSeleccionado = seleccionado
    ? productosConVariantes.has(seleccionado.id)
    : false;
  /** Si el producto requiere variante y no hay, bloqueamos el registro. */
  const requiereVariante = tieneVariantesSeleccionado && !varianteSeleccionada;

  const registrar = async () => {
    if (!sesion || !negocio || !seleccionado || !ubicacionId) return;
    if (requiereVariante) {
      setError('Este producto tiene variantes. Elegí una antes de registrar el ajuste.');
      return;
    }
    const abs = Number((cantidad.replace(/[^\d]/g, '').replace(/^0+/, '') || '0'));
    if (!abs) return;
    setError(null); setExito(null); setEnviando(true);
    try {
      const vlabel = varianteLabel(varianteSeleccionada?.modeloNombre ?? null, varianteSeleccionada?.talla ?? null);
      const etiqueta = vlabel ? `${seleccionado.nombre} · ${vlabel}` : seleccionado.nombre;
      const cantidadFinal = signo === '+' ? abs : -abs;

      // Payload coherente con HttpAjusteInventarioRepository.registrar.
      // El clientMovimientoId lo inyecta el manager (op.id). El backend es idempotente.
      const payload: Record<string, unknown> = {
        productoId: seleccionado.id,
        ubicacionId,
        cantidad: cantidadFinal,
        motivo,
      };
      if (varianteSeleccionada?.id) payload.varianteId = varianteSeleccionada.id;
      if (comentario) payload.comentario = comentario;

      const result = await executeOrEnqueue({
        type: 'AJUSTE_STOCK',
        negocioId: negocio.id,
        payload,
        label: `${signo}${abs} ${etiqueta}`,
      });

      if (result.executedOnline) {
        setExito(`Ajuste registrado: ${signo}${abs} ${etiqueta}`);
      } else {
        setExito(
          `Ajuste guardado sin conexión. Se sincronizará cuando haya red. (${signo}${abs} ${etiqueta})`,
        );
      }

      setSeleccionado(null);
      setVarianteSeleccionada(null);
      setCantidad('');
      setComentario('');

      // Sólo intentamos refrescar stock si estamos online — offline no tiene sentido
      // y el GET lanzaría error de red ruidoso.
      const online = useOfflineQueueStore.getState().online;
      if (online !== false && result.executedOnline) {
        try {
          await cargarStock();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Error al actualizar stock');
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al registrar');
    } finally { setEnviando(false); }
  };

  if (!puede) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={{ padding: spacing.lg }}>
          <Text style={styles.title}>Stock</Text>
          <Text style={styles.warn}>No tienes permisos para gestionar stock.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (esVendedor && !ubicacionId) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={{ padding: spacing.lg }}>
          <Text style={styles.title}>Stock</Text>
          <Text style={styles.warn}>No tienes una ubicación asignada.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!esVendedor && ubicaciones.length === 0) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={{ padding: spacing.lg }}>
          <Text style={styles.title}>Stock</Text>
          <Text style={styles.warn}>Aún no hay ubicaciones creadas en el negocio.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!ubicacionId) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={{ padding: spacing.lg }}>
          <Text style={styles.title}>Stock</Text>
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
        </View>
      </SafeAreaView>
    );
  }

  const selVarLabel = varianteLabel(
    varianteSeleccionada?.modeloNombre ?? null,
    varianteSeleccionada?.talla ?? null,
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        <Text style={styles.title}>Ajuste de stock</Text>
        <Text style={styles.sub}>{ubicacionNombre}</Text>

        <OfflineBanner />

        {!esVendedor && ubicaciones.length > 1 && (
          <View style={styles.chipsRow}>
            {ubicaciones.map((u) => (
              <Pressable
                key={u.id}
                onPress={() => { setUbicacionId(u.id); setSeleccionado(null); setVarianteSeleccionada(null); }}
                style={[styles.chip, ubicacionId === u.id && styles.chipActivo]}
              >
                <Text style={[styles.chipText, ubicacionId === u.id && styles.chipTextActivo]}>
                  {u.nombre}
                  <Text style={styles.chipTipo}>  {u.tipo === 'SUCURSAL' ? '(Sucursal)' : '(Bodega)'}</Text>
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {!seleccionado ? (
          <>
            <View style={styles.searchRow}>
              <TextInput
                value={query}
                onChangeText={(t) => { setQuery(t); buscar(t); }}
                placeholder="Buscar producto..."
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              <Pressable style={styles.scanBtn} onPress={() => setScannerVisible(true)}>
                <Text style={styles.scanText}>ESCANEAR</Text>
              </Pressable>
            </View>
            {buscando && <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.md }} />}
            {resultados.slice(0, 8).map((p) => {
              const cargandoEste = resolviendoProducto === p.id;
              const tieneVar = productosConVariantes.has(p.id);
              return (
                <Pressable
                  key={p.id}
                  style={styles.row}
                  onPress={() => elegirProducto(p)}
                  disabled={cargandoEste}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowNombre}>{p.nombre}</Text>
                    <Text style={styles.rowMeta}>
                      {p.sku ? `SKU ${p.sku}` : '—'}
                      {tieneVar ? ' · Con variantes' : ''}
                    </Text>
                  </View>
                  {cargandoEste
                    ? <ActivityIndicator color={colors.accent} />
                    : <Text style={styles.rowPrecio}>{formatCLP(p.precio)}</Text>}
                </Pressable>
              );
            })}

            {query.trim().length === 0 && (
              <>
                <Text style={styles.sectionTitle}>Stock actual ({stockItems.length})</Text>
                {cargandoStock && <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.md }} />}
                {!cargandoStock && stockItems.length === 0 && (
                  <Text style={styles.warn}>Sin stock registrado en esta ubicación.</Text>
                )}
                {stockItems.map((row) => {
                  const varLabel = varianteLabel(row.modeloNombre, row.varianteTalla);
                  const key = row.varianteId
                    ? `${row.producto.id}:${row.varianteId}`
                    : row.producto.id;
                  return (
                    <Pressable
                      key={key}
                      style={styles.row}
                      onPress={() => elegirFilaStock(row)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowNombre}>
                          {row.producto.nombre}
                          {varLabel ? ` · ${varLabel}` : ''}
                        </Text>
                        {row.producto.sku && <Text style={styles.rowMeta}>SKU {row.producto.sku}</Text>}
                      </View>
                      <Text style={[styles.stockQty, row.cantidad <= 0 && { color: colors.danger }]}>
                        {row.cantidad}
                      </Text>
                    </Pressable>
                  );
                })}
              </>
            )}
          </>
        ) : (
          <View style={styles.card}>
            <View style={styles.selRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.selNombre}>{seleccionado.nombre}</Text>
                {selVarLabel ? (
                  <Text style={styles.selVariante}>{selVarLabel}</Text>
                ) : tieneVariantesSeleccionado ? (
                  <Text style={[styles.selVariante, { color: colors.danger }]}>
                    Requiere variante
                  </Text>
                ) : (
                  seleccionado.sku && <Text style={styles.rowMeta}>SKU {seleccionado.sku}</Text>
                )}
              </View>
              <Pressable onPress={() => { setSeleccionado(null); setVarianteSeleccionada(null); }}>
                <Text style={styles.cambiar}>Cambiar</Text>
              </Pressable>
            </View>

            {tieneVariantesSeleccionado && (
              <Pressable
                style={styles.variantBtn}
                onPress={() => setSelectorVisible(true)}
              >
                <Text style={styles.variantBtnText}>
                  {varianteSeleccionada ? 'Cambiar variante' : 'Elegir variante'}
                </Text>
              </Pressable>
            )}

            <Text style={styles.label}>Tipo</Text>
            <View style={styles.tipoRow}>
              {(['-', '+'] as const).map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setSigno(s)}
                  style={[
                    styles.tipo,
                    signo === s && (s === '+' ? styles.tipoEntrada : styles.tipoSalida),
                  ]}
                >
                  <Text style={[styles.tipoText, signo === s && styles.tipoTextActivo]}>
                    {s === '+' ? 'Entrada (+)' : 'Salida (-)'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Cantidad</Text>
            <TextInput
              value={cantidad}
              onChangeText={(t) => {
                const soloDigitos = t.replace(/[^\d]/g, '');
                if (soloDigitos === '' || soloDigitos === '0') {
                  setCantidad(soloDigitos);
                } else {
                  setCantidad(soloDigitos.replace(/^0+/, '') || '0');
                }
              }}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              style={styles.inputBig}
              editable={!requiereVariante}
            />

            <Text style={styles.label}>Motivo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {MOTIVOS_AJUSTE.map((m) => (
                  <Pressable
                    key={m}
                    style={[styles.motivo, motivo === m && styles.motivoActivo]}
                    onPress={() => setMotivo(m)}
                  >
                    <Text style={[styles.motivoText, motivo === m && styles.motivoTextActivo]}>
                      {etiquetaMotivo[m]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.label}>Comentario (opcional)</Text>
            <TextInput
              value={comentario}
              onChangeText={setComentario}
              placeholder="Detalle..."
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            <Pressable
              style={[styles.btn, (!cantidad || enviando || requiereVariante) && styles.btnDisabled]}
              disabled={!cantidad || enviando || requiereVariante}
              onPress={registrar}
            >
              <Text style={styles.btnText}>REGISTRAR AJUSTE</Text>
            </Pressable>
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
        {exito && <Text style={styles.exito}>{exito}</Text>}
      </ScrollView>

      <ScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={onScan}
      />
      {sesion && negocio && (
        <SelectorVarianteModal
          visible={selectorVisible}
          producto={seleccionado}
          negocioId={negocio.id}
          token={sesion.token}
          bloquearSinStock={false}
          onClose={() => setSelectorVisible(false)}
          onSeleccionar={(_, variante) => {
            setVarianteSeleccionada(variante);
            setSelectorVisible(false);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { ...type.display, color: colors.text },
  sub: { ...type.body, color: colors.textMuted, marginBottom: spacing.md },
  warn: { color: colors.textMuted, ...type.body, marginTop: spacing.md },
  searchRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
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
  inputBig: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  scanBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  scanText: { color: '#000', ...type.label },
  row: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  rowNombre: { color: colors.text, ...type.body, fontWeight: '600' },
  rowMeta: { color: colors.textMuted, fontSize: 12 },
  rowPrecio: { color: colors.accent, ...type.body },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  selRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  selNombre: { ...type.title, color: colors.text },
  selVariante: { color: colors.accent, fontSize: 13, marginTop: 2, fontWeight: '600' },
  cambiar: { ...type.label, color: colors.accent },
  variantBtn: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  variantBtnText: { color: colors.accent, ...type.label, fontWeight: '700' },
  label: { ...type.label, color: colors.textMuted, marginTop: spacing.md },
  tipoRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  tipo: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  tipoEntrada: { backgroundColor: colors.success, borderColor: colors.success },
  tipoSalida: { backgroundColor: colors.danger, borderColor: colors.danger },
  tipoText: { color: colors.text, ...type.body, fontWeight: '600' },
  tipoTextActivo: { color: '#fff' },
  motivo: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  motivoActivo: { backgroundColor: colors.accent, borderColor: colors.accent },
  motivoText: { color: colors.text, ...type.body },
  motivoTextActivo: { color: '#000', fontWeight: '700' },
  btn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#000', ...type.label },
  error: { color: colors.danger, marginTop: spacing.md, ...type.body },
  exito: { color: colors.success, marginTop: spacing.md, ...type.body },
  chipsRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.md },
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
  chipTipo: { fontSize: 11, opacity: 0.7 },
  sectionTitle: { ...type.label, color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm },
  stockQty: { ...type.title, color: colors.accent, fontWeight: '700' },
});
