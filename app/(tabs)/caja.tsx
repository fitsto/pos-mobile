/**
 * Control de caja: apertura/cierre + movimientos (ingreso extra / retiro / ajuste).
 * Reutiliza StoreMember + Ubicacion. VENDEDOR trabaja con su ubicación asignada.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    View,
} from 'react-native';
import type { Caja } from '../../src/contexts/caja/domain/Caja';
import type { MovimientoCajaData } from '../../src/contexts/caja/domain/MovimientoCaja';
import type { TipoMovimientoCaja } from '../../src/contexts/caja/domain/types';
import type { Ubicacion } from '../../src/contexts/ubicacion/domain/Ubicacion';
import { Badge, Button, Card, Chip, Screen, Text, TextField } from '../../src/runtime/components/ui';
import { container } from '../../src/runtime/di/container';
import { useSesionStore } from '../../src/runtime/stores/SesionStore';
import { useTheme } from '../../src/runtime/theme/ThemeProvider';
import { formatCLP } from '../../src/runtime/utils/formato';

type MovimientoForm = Exclude<TipoMovimientoCaja, 'APERTURA' | 'CIERRE' | 'VENTA_EFECTIVO'>;

const MOV_LABEL: Record<MovimientoForm, string> = {
    INGRESO_EXTRA: 'Ingreso',
    RETIRO: 'Retiro',
    AJUSTE: 'Ajuste',
};

export default function CajaScreen() {
    const t = useTheme();
    const sesion = useSesionStore((s) => s.sesion);
    const negocio = useSesionStore((s) => s.negocio);
    const esVendedor = negocio?.rol === 'VENDEDOR';

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

    useEffect(() => {
        if (!sesion || !negocio || esVendedor) return;
        if (!negocio.usarControlCaja) {
            setCargando(false);
            return;
        }
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
        return () => {
            cancel = true;
        };
    }, [sesion, negocio, esVendedor]);

    const cargar = useCallback(async () => {
        if (!sesion || !negocio || !ubicacionId) {
            setCargando(false);
            return;
        }
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

    useEffect(() => {
        cargar();
    }, [cargar]);

    useFocusEffect(
        useCallback(() => {
            cargar();
        }, [cargar]),
    );

    const abrir = async () => {
        if (!sesion || !negocio || !ubicacionId) return;
        const monto = Number(aperturaMonto.replace(/[^\d]/g, ''));
        setEnviando(true);
        setError(null);
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
        } finally {
            setEnviando(false);
        }
    };

    const cerrar = async () => {
        if (!sesion || !negocio || !caja) return;
        const monto = Number(cerrarMonto.replace(/[^\d]/g, ''));
        setEnviando(true);
        setError(null);
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
        } finally {
            setEnviando(false);
        }
    };

    const registrarMov = async () => {
        if (!sesion || !negocio || !caja) return;
        const monto = Number(movMonto.replace(/[^\d]/g, ''));
        setEnviando(true);
        setError(null);
        try {
            await container.registrarMovimientoCaja.execute({
                negocioId: negocio.id,
                cajaId: caja.id,
                tipo: movTipo,
                monto,
                descripcion: movDesc || null,
                token: sesion.token,
            });
            setMovMonto('');
            setMovDesc('');
            await cargar();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al registrar');
        } finally {
            setEnviando(false);
        }
    };

    // 1) Control de caja deshabilitado
    if (negocio && !negocio.usarControlCaja) {
        return (
            <Screen title="Caja">
                <Card variant="subtle" padding={3}>
                    <Text variant="bodySm" tone="secondary">
                        El control de caja está deshabilitado en esta tienda. Actívalo desde Configuración en el panel web si lo necesitas.
                    </Text>
                </Card>
            </Screen>
        );
    }

    // 2) VENDEDOR sin sucursal
    if (esVendedor && !ubicacionId) {
        return (
            <Screen title="Caja">
                <Card variant="subtle" padding={3}>
                    <Text variant="bodySm" tone="secondary">
                        No tienes una sucursal asignada. Pide a un administrador que te asigne una ubicación.
                    </Text>
                </Card>
            </Screen>
        );
    }

    // 3) ADMIN sin sucursales creadas
    if (!esVendedor && sucursales.length === 0 && !cargando) {
        return (
            <Screen title="Caja">
                <Card variant="subtle" padding={3}>
                    <Text variant="bodySm" tone="secondary">
                        No tienes ubicaciones tipo SUCURSAL. La caja solo opera en sucursales — crea una desde el panel web.
                    </Text>
                </Card>
            </Screen>
        );
    }

    if (cargando) {
        return (
            <Screen>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator color={t.color.accent.default} />
                </View>
            </Screen>
        );
    }

    return (
        <Screen paddingH={0} title="Caja" subtitle={ubicacionNombre ?? undefined}>
            <ScrollView
                contentContainerStyle={{
                    paddingHorizontal: t.space['4'],
                    paddingBottom: t.space['6'],
                    gap: t.space['3'],
                }}
                refreshControl={
                    <RefreshControl
                        refreshing={refrescando}
                        onRefresh={() => {
                            setRefrescando(true);
                            cargar();
                        }}
                        tintColor={t.color.accent.default}
                    />
                }
            >
                {!esVendedor && sucursales.length > 1 ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space['2'] }}>
                        {sucursales.map((u) => (
                            <Chip
                                key={u.id}
                                label={u.nombre}
                                selected={ubicacionId === u.id}
                                onPress={() => setUbicacionId(u.id)}
                            />
                        ))}
                    </View>
                ) : null}

                {error ? (
                    <Text variant="bodySm" tone="danger">{error}</Text>
                ) : null}

                {caja && caja.estaAbierta ? (
                    <>
                        <Card variant="subtle" padding={4}>
                            <Badge
                                tone="success"
                                variant="solid"
                                label="Caja abierta"
                                style={{ alignSelf: 'flex-start', marginBottom: t.space['3'] }}
                            />
                            <Text variant="label" tone="tertiary">APERTURA</Text>
                            <Text variant="monoMd" tabular style={{ marginTop: 2 }}>
                                {formatCLP(caja.montoApertura)}
                            </Text>
                            <View style={{ height: 1, backgroundColor: t.color.border.subtle, marginVertical: t.space['3'] }} />
                            <Text variant="label" tone="tertiary">SALDO ESPERADO</Text>
                            <Text
                                variant="displayMd"
                                tabular
                                style={{ fontFamily: t.font.mono, color: t.color.accent.default, marginTop: 2 }}
                            >
                                {formatCLP(saldo)}
                            </Text>
                        </Card>

                        <Text variant="label" tone="tertiary" style={{ marginTop: t.space['3'] }}>
                            MOVIMIENTO
                        </Text>
                        <Card variant="subtle" padding={4}>
                            <View style={{ flexDirection: 'row', gap: t.space['2'], flexWrap: 'wrap', marginBottom: t.space['3'] }}>
                                {(['INGRESO_EXTRA', 'RETIRO', 'AJUSTE'] as MovimientoForm[]).map((ti) => (
                                    <Chip
                                        key={ti}
                                        label={MOV_LABEL[ti]}
                                        selected={movTipo === ti}
                                        onPress={() => setMovTipo(ti)}
                                    />
                                ))}
                            </View>
                            <TextField
                                placeholder="Monto"
                                value={movMonto}
                                onChangeText={setMovMonto}
                                keyboardType="number-pad"
                                mono
                                style={{ marginBottom: t.space['3'] }}
                            />
                            <TextField
                                placeholder="Descripción (opcional)"
                                value={movDesc}
                                onChangeText={setMovDesc}
                                style={{ marginBottom: t.space['3'] }}
                            />
                            <Button
                                label="Registrar"
                                onPress={registrarMov}
                                disabled={!movMonto || enviando}
                                loading={enviando}
                                fullWidth
                            />
                        </Card>

                        <Text variant="label" tone="tertiary" style={{ marginTop: t.space['3'] }}>
                            CERRAR CAJA (ARQUEO)
                        </Text>
                        <Card variant="subtle" padding={4}>
                            <TextField
                                placeholder="Monto declarado"
                                value={cerrarMonto}
                                onChangeText={setCerrarMonto}
                                keyboardType="number-pad"
                                mono
                                helper={
                                    cerrarMonto
                                        ? `Diferencia: ${formatCLP(Number(cerrarMonto.replace(/[^\d]/g, '')) - saldo)}`
                                        : undefined
                                }
                                style={{ marginBottom: t.space['3'] }}
                            />
                            <Button
                                variant="danger"
                                label="Cerrar caja"
                                onPress={cerrar}
                                disabled={!cerrarMonto || enviando}
                                loading={enviando}
                                fullWidth
                            />
                        </Card>

                        <Text variant="label" tone="tertiary" style={{ marginTop: t.space['3'] }}>
                            MOVIMIENTOS
                        </Text>
                        <Card variant="subtle" padding={0}>
                            {movs.length === 0 ? (
                                <Text variant="bodySm" tone="tertiary" align="center" style={{ padding: t.space['4'] }}>
                                    Sin movimientos
                                </Text>
                            ) : (
                                movs.map((m, idx) => (
                                    <View
                                        key={m.id}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            paddingHorizontal: t.space['4'],
                                            paddingVertical: t.space['3'],
                                            borderBottomWidth: idx < movs.length - 1 ? t.border.default : 0,
                                            borderBottomColor: t.color.border.subtle,
                                        }}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text variant="bodyMd" emphasized>{m.tipo}</Text>
                                            {m.descripcion ? (
                                                <Text variant="bodySm" tone="tertiary">{m.descripcion}</Text>
                                            ) : null}
                                        </View>
                                        <Text
                                            variant="monoMd"
                                            tabular
                                            emphasized
                                            tone={
                                                m.monto < 0 ? 'danger' : m.monto > 0 ? 'success' : 'primary'
                                            }
                                        >
                                            {formatCLP(m.monto)}
                                        </Text>
                                    </View>
                                ))
                            )}
                        </Card>
                    </>
                ) : (
                    <>
                        <Card variant="subtle" padding={4}>
                            <Badge
                                tone="neutral"
                                variant="soft"
                                label="Sin caja abierta"
                                style={{ alignSelf: 'flex-start', marginBottom: t.space['3'] }}
                            />
                            <Text variant="bodyMd" tone="secondary">
                                Abre la caja para comenzar a vender.
                            </Text>
                        </Card>

                        <Text variant="label" tone="tertiary" style={{ marginTop: t.space['3'] }}>
                            ABRIR CAJA
                        </Text>
                        <Card variant="subtle" padding={4}>
                            <TextField
                                placeholder="Monto de apertura"
                                value={aperturaMonto}
                                onChangeText={setAperturaMonto}
                                keyboardType="number-pad"
                                mono
                                style={{ marginBottom: t.space['3'] }}
                            />
                            <Button
                                label="Abrir caja"
                                onPress={abrir}
                                disabled={!aperturaMonto || enviando}
                                loading={enviando}
                                fullWidth
                            />
                        </Card>
                    </>
                )}
            </ScrollView>
        </Screen>
    );
}
