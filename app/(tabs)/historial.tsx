import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, type } from '../../src/runtime/theme/tokens';
import { container } from '../../src/runtime/di/container';
import { useSesionStore } from '../../src/runtime/stores/SesionStore';
import { formatCLP } from '../../src/runtime/utils/formato';
import type { VentaDetalle, VentaResumen } from '../../src/contexts/venta/domain/Venta';

function formatFechaCorta(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFechaLarga(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const MEDIO_LABEL: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  DEBITO: 'Débito',
  CREDITO: 'Crédito',
  TRANSFERENCIA: 'Transferencia',
};

export default function HistorialScreen() {
  const sesion = useSesionStore((s) => s.sesion);
  const negocio = useSesionStore((s) => s.negocio);

  const [ventas, setVentas] = useState<VentaResumen[]>([]);
  const [cargando, setCargando] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<VentaDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!sesion || !negocio) return;
    setCargando(true);
    setError(null);
    try {
      const res = await container.listarVentas.execute({
        negocioId: negocio.id,
        token: sesion.token,
        pageSize: 30,
      });
      setVentas(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos cargar el historial');
    } finally {
      setCargando(false);
    }
  }, [sesion, negocio]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const onRefresh = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  const abrirDetalle = async (ventaId: string) => {
    if (!sesion || !negocio) return;
    setSeleccionadaId(ventaId);
    setDetalle(null);
    setErrorDetalle(null);
    setCargandoDetalle(true);
    try {
      const d = await container.obtenerVenta.execute({
        negocioId: negocio.id,
        ventaId,
        token: sesion.token,
      });
      setDetalle(d);
    } catch (e) {
      setErrorDetalle(e instanceof Error ? e.message : 'No pudimos cargar el detalle');
    } finally {
      setCargandoDetalle(false);
    }
  };

  const cerrarDetalle = () => {
    setSeleccionadaId(null);
    setDetalle(null);
    setErrorDetalle(null);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.titleSmall}>Historial de ventas</Text>
        <Text style={styles.sub}>{negocio?.nombre ?? ''}</Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {cargando && ventas.length === 0 ? (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={ventas}
          keyExtractor={(v) => v.id}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          contentContainerStyle={ventas.length === 0 ? styles.empty : { paddingBottom: spacing.xl }}
          ListEmptyComponent={
            !cargando ? (
              <Text style={styles.emptyText}>Todavía no hay ventas registradas.</Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => abrirDetalle(item.id)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>
                  {formatFechaCorta(item.fechaHora)} · {MEDIO_LABEL[item.medioPago] ?? item.medioPago}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {item.ubicacionNombre ?? '—'} · {item.canal === 'PRESENCIAL' ? 'Presencial' : 'Online'}
                  {item.cantidadItems ? ` · ${item.cantidadItems} items` : ''}
                </Text>
              </View>
              <Text style={styles.rowTotal}>{formatCLP(item.totalBruto)}</Text>
            </Pressable>
          )}
        />
      )}

      <Modal
        visible={seleccionadaId != null}
        animationType="slide"
        onRequestClose={cerrarDetalle}
        transparent={false}
      >
        <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.modalHeader}>
            <Pressable onPress={cerrarDetalle} hitSlop={12}>
              <Text style={styles.closeBtn}>Cerrar</Text>
            </Pressable>
            <Text style={styles.titleSmall}>Detalle de venta</Text>
            <View style={{ width: 54 }} />
          </View>

          {cargandoDetalle ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : errorDetalle ? (
            <Text style={styles.error}>{errorDetalle}</Text>
          ) : detalle ? (
            <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Fecha</Text>
                <Text style={styles.cardValue}>{formatFechaLarga(detalle.fechaHora)}</Text>
                <View style={styles.divider} />
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.cardLabel}>Canal</Text>
                    <Text style={styles.cardValue}>
                      {detalle.canal === 'PRESENCIAL' ? 'Presencial' : 'Online'}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.cardLabel}>Medio de pago</Text>
                    <Text style={styles.cardValue}>
                      {MEDIO_LABEL[detalle.medioPago] ?? detalle.medioPago}
                    </Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <Text style={styles.cardLabel}>Ubicación</Text>
                <Text style={styles.cardValue}>{detalle.ubicacionNombre ?? '—'}</Text>
              </View>

              <Text style={styles.sectionTitle}>Productos</Text>
              <View style={styles.card}>
                {detalle.detalles.map((d, idx) => (
                  <View
                    key={d.id}
                    style={[
                      styles.itemRow,
                      idx < detalle.detalles.length - 1 && styles.itemRowBorder,
                    ]}
                  >
                    {d.productoImagenUrl ? (
                      <Image source={{ uri: d.productoImagenUrl }} style={styles.itemThumb} resizeMode="cover" />
                    ) : (
                      <View style={[styles.itemThumb, styles.itemThumbPlaceholder]}>
                        <Text style={styles.itemThumbPlaceholderText}>
                          {d.productoNombre.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemNombre} numberOfLines={2}>
                        {d.productoNombre}
                      </Text>
                      <Text style={styles.itemMeta}>
                        {d.cantidad} × {formatCLP(d.precioVentaFinalUnitario)}
                      </Text>
                    </View>
                    <Text style={styles.itemTotal}>{formatCLP(d.totalBruto)}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>{formatCLP(detalle.totalBruto)}</Text>
                </View>
                {detalle.montoRecibido != null && (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.rowBetween}>
                      <Text style={styles.cardLabel}>Recibido</Text>
                      <Text style={styles.cardValue}>{formatCLP(detalle.montoRecibido)}</Text>
                    </View>
                    {detalle.vuelto != null && (
                      <View style={styles.rowBetween}>
                        <Text style={styles.cardLabel}>Vuelto</Text>
                        <Text style={styles.cardValue}>{formatCLP(detalle.vuelto)}</Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  titleSmall: { ...type.title, color: colors.text },
  sub: { ...type.body, color: colors.textMuted },
  error: {
    color: colors.danger,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    ...type.body,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyText: { color: colors.textMuted, ...type.body, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  rowTitle: { color: colors.text, ...type.body, fontWeight: '600' },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  rowTotal: { color: colors.accent, ...type.body, fontWeight: '700' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeBtn: { color: colors.accent, ...type.body, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardLabel: { ...type.label, color: colors.textMuted },
  cardValue: { ...type.body, color: colors.text, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: {
    ...type.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemThumb: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  itemThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemThumbPlaceholderText: { color: colors.textMuted, fontSize: 16, fontWeight: '700' },
  itemNombre: { color: colors.text, ...type.body, fontWeight: '600' },
  itemMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  itemTotal: { color: colors.text, ...type.body, fontWeight: '700' },
  totalLabel: { ...type.title, color: colors.text },
  totalValue: { ...type.display, color: colors.accent, fontSize: 22 },
});
