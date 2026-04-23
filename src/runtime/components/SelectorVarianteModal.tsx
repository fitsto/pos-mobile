import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius, spacing, type } from '../theme/tokens';
import { formatCLP } from '../utils/formato';
import { container } from '../di/container';
import type { Producto } from '../../contexts/producto/domain/Producto';
import type { Modelo, Variante } from '../../contexts/producto/domain/Variante';
import type { VarianteInfo } from '../../contexts/venta/domain/ItemCarrito';

interface Props {
  visible: boolean;
  producto: Producto | null;
  negocioId: string;
  token: string;
  /** Mapa varianteId → cantidad disponible en la ubicación activa. Opcional. */
  stockPorVariante?: Map<string, number>;
  onClose: () => void;
  /** Llamada cuando se elige variante. Devuelve el info listo para el carrito / ajuste. */
  onSeleccionar: (producto: Producto, variante: VarianteInfo, raw: Variante) => void;
  /** Si se pasa, muestra "sin stock" cuando la variante no tiene disponibilidad. */
  bloquearSinStock?: boolean;
  /** Provider alternativo (ej. SQLite local). Si se pasa, no consulta al backend. */
  provider?: (productoId: string) => Promise<{ variantes: Variante[]; modelos: Modelo[] }>;
}

interface VarianteVista {
  variante: Variante;
  modelo: Modelo | null;
  precio: number;
  stock: number | null;
}

function groupByModelo(vs: VarianteVista[]): Array<{ modelo: Modelo | null; items: VarianteVista[] }> {
  const byId = new Map<string, { modelo: Modelo | null; items: VarianteVista[] }>();
  const sinModeloKey = '__none__';
  for (const v of vs) {
    const key = v.modelo?.id ?? sinModeloKey;
    if (!byId.has(key)) byId.set(key, { modelo: v.modelo, items: [] });
    byId.get(key)!.items.push(v);
  }
  return Array.from(byId.values()).sort((a, b) => {
    const oa = a.modelo?.orden ?? 9999;
    const ob = b.modelo?.orden ?? 9999;
    if (oa !== ob) return oa - ob;
    return (a.modelo?.nombre ?? '').localeCompare(b.modelo?.nombre ?? '');
  });
}

export function SelectorVarianteModal({
  visible,
  producto,
  negocioId,
  token,
  stockPorVariante,
  onClose,
  onSeleccionar,
  bloquearSinStock = false,
  provider,
}: Props) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variantes, setVariantes] = useState<Variante[]>([]);
  const [modelos, setModelos] = useState<Modelo[]>([]);

  useEffect(() => {
    if (!visible || !producto) return;
    let activo = true;
    setCargando(true);
    setError(null);
    const loader = provider
      ? provider(producto.id)
      : container.listarVariantes.execute({ negocioId, productoId: producto.id, token });
    loader
      .then(({ variantes: vs, modelos: ms }) => {
        if (!activo) return;
        setVariantes(vs);
        setModelos(ms);
      })
      .catch((e: unknown) => {
        if (!activo) return;
        setError(e instanceof Error ? e.message : 'Error al cargar variantes');
      })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [visible, producto, negocioId, token, provider]);

  const vistas: VarianteVista[] = useMemo(() => {
    if (!producto) return [];
    const modeloById = new Map(modelos.map((m) => [m.id, m]));
    return variantes
      .map<VarianteVista>((v) => ({
        variante: v,
        modelo: v.modeloId ? modeloById.get(v.modeloId) ?? null : null,
        precio: v.precioVentaFinal ?? producto.precio,
        stock: stockPorVariante ? stockPorVariante.get(v.id) ?? 0 : null,
      }))
      .sort((a, b) => a.variante.orden - b.variante.orden);
  }, [variantes, modelos, producto, stockPorVariante]);

  const grupos = useMemo(() => groupByModelo(vistas), [vistas]);

  const seleccionar = (v: VarianteVista) => {
    if (!producto) return;
    if (bloquearSinStock && v.stock !== null && v.stock <= 0) return;
    const info: VarianteInfo = {
      id: v.variante.id,
      modeloNombre: v.modelo?.nombre ?? null,
      talla: v.variante.talla,
      precioVentaFinal: v.variante.precioVentaFinal,
    };
    onSeleccionar(producto, info, v.variante);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Elegí variante</Text>
              <Text style={styles.title} numberOfLines={1}>
                {producto?.nombre ?? ''}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.closeBtn}>Cerrar</Text>
            </Pressable>
          </View>

          {cargando && (
            <View style={{ padding: spacing.xl, alignItems: 'center' }}>
              <ActivityIndicator color={colors.accent} />
            </View>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
          {!cargando && !error && vistas.length === 0 && (
            <Text style={styles.empty}>Este producto no tiene variantes activas.</Text>
          )}

          <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ paddingBottom: spacing.lg }}>
            {grupos.map((g, gi) => (
              <View key={g.modelo?.id ?? `grp-${gi}`} style={styles.grupo}>
                {g.modelo && (
                  <View style={styles.grupoHeader}>
                    {g.modelo.imagenUrl ? (
                      <Image source={{ uri: g.modelo.imagenUrl }} style={styles.modeloThumb} resizeMode="cover" />
                    ) : (
                      <View style={[styles.modeloThumb, styles.modeloThumbPh]}>
                        <Text style={styles.modeloThumbPhText}>
                          {g.modelo.nombre.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.grupoTitulo}>{g.modelo.nombre}</Text>
                  </View>
                )}
                {g.items.map((v) => {
                  const sinStock = bloquearSinStock && v.stock !== null && v.stock <= 0;
                  return (
                    <Pressable
                      key={v.variante.id}
                      onPress={() => seleccionar(v)}
                      disabled={sinStock}
                      style={[styles.row, sinStock && styles.rowDisabled]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>
                          {v.variante.talla ?? 'Sin talla'}
                        </Text>
                        <Text style={styles.rowMeta}>
                          {v.variante.sku ? `SKU ${v.variante.sku}` : v.variante.codigoBarra ? `CB ${v.variante.codigoBarra}` : '—'}
                          {v.stock !== null ? ` · Stock ${v.stock}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.rowPrecio}>{formatCLP(v.precio)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  label: { ...type.label, color: colors.textMuted },
  title: { ...type.title, color: colors.text },
  closeBtn: { color: colors.accent, ...type.label, fontWeight: '700' },
  error: { color: colors.danger, ...type.body, padding: spacing.md },
  empty: { color: colors.textMuted, ...type.body, padding: spacing.md, textAlign: 'center' },
  grupo: { marginTop: spacing.sm },
  grupoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  grupoTitulo: { ...type.body, color: colors.text, fontWeight: '700' },
  modeloThumb: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  modeloThumbPh: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  modeloThumbPhText: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  rowDisabled: { opacity: 0.4 },
  rowTitle: { color: colors.text, ...type.body, fontWeight: '600' },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  rowPrecio: { color: colors.accent, ...type.body, fontWeight: '700' },
});
