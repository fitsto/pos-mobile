import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
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
import type { Caja } from '../../src/contexts/caja/domain/Caja';
import type { MovimientoCajaData } from '../../src/contexts/caja/domain/MovimientoCaja';
import type { TipoMovimientoCaja } from '../../src/contexts/caja/domain/types';
import type { Ubicacion } from '../../src/contexts/ubicacion/domain/Ubicacion';

type MovimientoForm = Exclude<TipoMovimientoCaja, 'APERTURA' | 'CIERRE' | 'VENTA_EFECTIVO'>;

export default function CajaScreen() {
  const sesion = useSesionStore((s) => s.sesion);
  const negocio = useSesionStore((s) => s.negocio);
  const esVendedor = negocio?.rol === 'VENDEDOR';

  // Sucursales disponibles (sólo SUCURSAL) para ADMIN/GERENTE.
  const [sucursales, setSucursales] = useState<Ubicacion[]>([]);
  const [ubicacionId, setUbicacionId] = useState<string | null>(
    esVendedor ? (negocio?.ubicacionId ?? null) : null,
  );
  const ubicacionNombre = useMemo(() => {
    if (esVendedor) return negocio?.ubicacionNombre ?? null;
    return sucursales.find((u) => u.id === ubicacionId)?.nombre ?? null;
  }, [esVendedor, negocio, sucursales, ubicacionId]);

  const [caja, setCaja] = useState<Caja | null>(null);
  const [movs, setMovs] = useState<MovimientoCajaData[]>([]);
  const [saldo, setSaldo] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [aperturaMonto, setAperturaMonto] = useState('');
  const [cerrarMonto, setCerrarMonto] = useState('');
  const [movTipo, setMovTipo] = useState<MovimientoForm>('INGRESO_EXTRA');
  const [movMonto, setMovMonto] = useState('');
  const [movDesc, setMovDesc] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Cargar sucursales una vez (si no es vendedor).
  useEffect(() => {
    if (!sesion || !negocio || esVendedor) return;
    if (!negocio.usarControlCaja) { setCargando(false); return; }
    let cancel = false;
    (async () => {
      try {
        const list = await container.listarUbicaciones.execute({
          negocioId: negocio.id,
          token: sesion.token,
        });
        if (cancel) return;
        const solo = list.filter((u) => String(u.tipo ?? '').trim().toUpperCase() === 'SUCURSAL');
        setSucursales(solo);
        if (!ubicacionId && solo.length > 0) setUbicacionId(solo[0].id);
        if (solo.length === 0) setCargando(false);
      } catch (e) {
        if (!cancel) {
          setError(e instanceof Error ? e.message : 'Error al cargar sucursales');
          setCargando(false);
        }
      }
    })();
    return () => { cancel = true; };
  }, [sesion, negocio, esVendedor]);

  const cargar = useCallback(async () => {
    if (!sesion || !negocio || !ubicacionId) { setCargando(false); return; }
    setError(null);
    try {
      const res = await container.obtenerCajaActual.execute({
        negocioId: negocio.id,
        ubicacionId,
        token: sesion.token,
      });
      setCaja(res.caja);
      setMovs(res.movimientos);
      setSaldo(res.saldo);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar caja');
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, [sesion, negocio, ubicacionId]);

  useEffect(() => { cargar(); }, [cargar]);

  // Recargar cada vez que la pantalla recibe foco (volver desde POS tras una venta).
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const abrir = async () => {
    if (!sesion || !negocio || !ubicacionId) return;
    const monto = Number(aperturaMonto.replace(/[^\d]/g, ''));
    setEnviando(true); setError(null);
    try {
      await container.abrirCaja.execute({
        negocioId: negocio.id,
        ubicacionId,
        montoApertura: monto,
        token: sesion.token,
      });
      setAperturaMonto('');
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al abrir caja');
    } finally { setEnviando(false); }
  };

  const cerrar = async () => {
    if (!sesion || !negocio || !caja) return;
    const monto = Number(cerrarMonto.replace(/[^\d]/g, ''));
    setEnviando(true); setError(null);
    try {
      await container.cerrarCaja.execute({
        negocioId: negocio.id,
        cajaId: caja.id,
        montoDeclarado: monto,
        token: sesion.token,
      });
      setCerrarMonto('');
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cerrar caja');
    } finally { setEnviando(false); }
  };

  const registrarMov = async () => {
    if (!sesion || !negocio || !caja) return;
    const monto = Number(movMonto.replace(/[^\d]/g, ''));
    setEnviando(true); setError(null);
    try {
      await container.registrarMovimientoCaja.execute({
        negocioId: negocio.id,
        cajaId: caja.id,
        tipo: movTipo,
        monto,
        descripcion: movDesc || null,
        token: sesion.token,
      });
      setMovMonto(''); setMovDesc('');
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al registrar');
    } finally { setEnviando(false); }
  };

  // 1) Control de caja deshabilitado
  if (negocio && !negocio.usarControlCaja) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={{ padding: spacing.lg }}>
          <Text style={styles.title}>Caja</Text>
          <View style={styles.warning}>
            <Text style={styles.warningText}>
              El control de caja está deshabilitado en este negocio. Actívalo desde Configuración en el panel web si lo necesitas.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // 2) VENDEDOR sin sucursal asignada (no debería pasar, pero por defensa)
  if (esVendedor && !ubicacionId) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={{ padding: spacing.lg }}>
          <Text style={styles.title}>Caja</Text>
          <View style={styles.warning}>
            <Text style={styles.warningText}>
              No tienes una sucursal asignada. Pide a un administrador que te asigne una ubicación.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // 3) ADMIN/GERENTE sin sucursales creadas
  if (!esVendedor && sucursales.length === 0 && !cargando) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={{ padding: spacing.lg }}>
          <Text style={styles.title}>Caja</Text>
          <View style={styles.warning}>
            <Text style={styles.warningText}>
              No tienes ubicaciones tipo SUCURSAL. La caja sólo opera en sucursales — crea una desde el panel web.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (cargando) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => { setRefrescando(true); cargar(); }}
            tintColor={colors.accent}
          />
        }
      >
        <Text style={styles.title}>Caja</Text>
        <Text style={styles.sub}>{ubicacionNombre}</Text>

        {!esVendedor && sucursales.length > 1 && (
          <View style={styles.chipsRow}>
            {sucursales.map((u) => (
              <Pressable
                key={u.id}
                onPress={() => setUbicacionId(u.id)}
                style={[styles.chip, ubicacionId === u.id && styles.chipActivo]}
              >
                <Text style={[styles.chipText, ubicacionId === u.id && styles.chipTextActivo]}>
                  {u.nombre}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        {caja && caja.estaAbierta ? (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>Estado</Text>
              <Text style={[styles.badge, styles.badgeOk]}>ABIERTA</Text>
              <Text style={styles.label}>Apertura</Text>
              <Text style={styles.info}>{formatCLP(caja.montoApertura)}</Text>
              <Text style={styles.label}>Saldo esperado</Text>
              <Text style={styles.saldo}>{formatCLP(saldo)}</Text>
            </View>

            <Text style={styles.sectionTitle}>Movimiento</Text>
            <View style={styles.card}>
              <View style={styles.tipoRow}>
                {(['INGRESO_EXTRA', 'RETIRO', 'AJUSTE'] as MovimientoForm[]).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setMovTipo(t)}
                    style={[styles.tipo, movTipo === t && styles.tipoActivo]}
                  >
                    <Text style={[styles.tipoText, movTipo === t && styles.tipoTextActivo]}>
                      {t === 'INGRESO_EXTRA' ? 'Ingreso' : t === 'RETIRO' ? 'Retiro' : 'Ajuste'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={movMonto}
                onChangeText={setMovMonto}
                placeholder="Monto"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                style={styles.input}
              />
              <TextInput
                value={movDesc}
                onChangeText={setMovDesc}
                placeholder="Descripción (opcional)"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              <Pressable
                style={[styles.btn, !movMonto && styles.btnDisabled]}
                disabled={!movMonto || enviando}
                onPress={registrarMov}
              >
                <Text style={styles.btnText}>REGISTRAR</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>Cerrar caja (arqueo)</Text>
            <View style={styles.card}>
              <TextInput
                value={cerrarMonto}
                onChangeText={setCerrarMonto}
                placeholder="Monto declarado"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                style={styles.input}
              />
              {cerrarMonto !== '' && (
                <Text style={styles.difHint}>
                  Diferencia: {formatCLP(Number(cerrarMonto.replace(/[^\d]/g, '')) - saldo)}
                </Text>
              )}
              <Pressable
                style={[styles.btn, styles.btnDanger, !cerrarMonto && styles.btnDisabled]}
                disabled={!cerrarMonto || enviando}
                onPress={cerrar}
              >
                <Text style={styles.btnText}>CERRAR CAJA</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>Movimientos</Text>
            <FlatList
              scrollEnabled={false}
              data={movs}
              keyExtractor={(m) => m.id}
              ListEmptyComponent={<Text style={styles.empty}>Sin movimientos</Text>}
              renderItem={({ item }) => (
                <View style={styles.movRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.movTipo}>{item.tipo}</Text>
                    {item.descripcion && <Text style={styles.movDesc}>{item.descripcion}</Text>}
                  </View>
                  <Text
                    style={[
                      styles.movMonto,
                      item.monto < 0 && { color: colors.danger },
                      item.monto > 0 && { color: colors.success },
                    ]}
                  >
                    {formatCLP(item.monto)}
                  </Text>
                </View>
              )}
            />
          </>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>Estado</Text>
              <Text style={[styles.badge, styles.badgeIdle]}>SIN CAJA ABIERTA</Text>
              <Text style={styles.hint}>Abre la caja para comenzar a vender.</Text>
            </View>
            <Text style={styles.sectionTitle}>Abrir caja</Text>
            <View style={styles.card}>
              <TextInput
                value={aperturaMonto}
                onChangeText={setAperturaMonto}
                placeholder="Monto de apertura"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                style={styles.input}
              />
              <Pressable
                style={[styles.btn, !aperturaMonto && styles.btnDisabled]}
                disabled={!aperturaMonto || enviando}
                onPress={abrir}
              >
                <Text style={styles.btnText}>ABRIR CAJA</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { ...type.display, color: colors.text },
  sub: { ...type.body, color: colors.textMuted, marginBottom: spacing.md },
  sectionTitle: { ...type.label, color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { ...type.label, color: colors.textMuted, marginTop: spacing.sm },
  info: { ...type.title, color: colors.text },
  saldo: { ...type.display, color: colors.accent },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    overflow: 'hidden',
    ...type.label,
    marginBottom: spacing.sm,
  },
  badgeOk: { backgroundColor: colors.success, color: '#fff' },
  badgeIdle: { backgroundColor: colors.surfaceAlt, color: colors.textMuted },
  hint: { ...type.body, color: colors.textMuted, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    marginTop: spacing.sm,
    ...type.body,
  },
  btn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  btnDanger: { backgroundColor: colors.danger },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#000', ...type.label },
  tipoRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  tipo: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  tipoActivo: { backgroundColor: colors.accent, borderColor: colors.accent },
  tipoText: { color: colors.text, ...type.body },
  tipoTextActivo: { color: '#000', fontWeight: '700' },
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
  difHint: { ...type.label, color: colors.textMuted, marginTop: spacing.sm },
  error: { color: colors.danger, marginVertical: spacing.sm, ...type.body },
  empty: { color: colors.textMuted, padding: spacing.md, textAlign: 'center' },
  movRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  movTipo: { color: colors.text, ...type.body, fontWeight: '600' },
  movDesc: { color: colors.textMuted, fontSize: 12 },
  movMonto: { color: colors.text, ...type.body, fontWeight: '700' },
  warning: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: '#3A2515',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accentDark,
  },
  warningText: { color: colors.accent, ...type.body },
});
