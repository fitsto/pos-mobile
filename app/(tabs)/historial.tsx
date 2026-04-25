/**
 * Historial de ventas + detalle en modal full screen.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { VentaDetalle, VentaResumen } from '../../src/contexts/venta/domain/Venta';
import { Card, Screen, Text } from '../../src/runtime/components/ui';
import { container } from '../../src/runtime/di/container';
import { useSesionStore } from '../../src/runtime/stores/SesionStore';
import { useTheme } from '../../src/runtime/theme/ThemeProvider';
import { formatCLP } from '../../src/runtime/utils/formato';

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
    const t = useTheme();
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
        <Screen
            paddingH={0}
            title="Historial"
            subtitle={negocio?.nombre}
        >
            {error ? (
                <Text variant="bodySm" tone="danger" style={{ paddingHorizontal: t.space['4'] }}>
                    {error}
                </Text>
            ) : null}

            {cargando && ventas.length === 0 ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator color={t.color.accent.default} />
                </View>
            ) : (
                <FlatList
                    data={ventas}
                    keyExtractor={(v) => v.id}
                    refreshControl={
                        <RefreshControl
                            refreshing={refrescando}
                            onRefresh={onRefresh}
                            tintColor={t.color.accent.default}
                        />
                    }
                    contentContainerStyle={
                        ventas.length === 0
                            ? { flex: 1, alignItems: 'center', justifyContent: 'center' }
                            : { paddingBottom: t.space['6'] }
                    }
                    ListEmptyComponent={
                        !cargando ? (
                            <Text variant="bodyMd" tone="tertiary" align="center" style={{ paddingHorizontal: t.space['6'] }}>
                                Todavía no hay ventas registradas.
                            </Text>
                        ) : null
                    }
                    renderItem={({ item }) => (
                        <Pressable
                            onPress={() => abrirDetalle(item.id)}
                            style={({ pressed }) => ({
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingHorizontal: t.space['4'],
                                paddingVertical: t.space['3'],
                                borderBottomWidth: t.border.default,
                                borderBottomColor: t.color.border.subtle,
                                gap: t.space['3'],
                                backgroundColor: pressed ? t.color.bg.sunken : 'transparent',
                            })}
                        >
                            <View style={{ flex: 1 }}>
                                <Text variant="bodyMd" emphasized>
                                    {formatFechaCorta(item.fechaHora)} · {MEDIO_LABEL[item.medioPago] ?? item.medioPago}
                                </Text>
                                <Text variant="bodySm" tone="tertiary" numberOfLines={1} style={{ marginTop: 2 }}>
                                    {item.ubicacionNombre ?? '—'} ·{' '}
                                    {item.canal === 'PRESENCIAL' ? 'Presencial' : 'Online'}
                                    {item.cantidadItems ? ` · ${item.cantidadItems} items` : ''}
                                </Text>
                            </View>
                            <Text variant="monoMd" tabular emphasized>{formatCLP(item.totalBruto)}</Text>
                            <Ionicons name="chevron-forward" size={16} color={t.color.fg.tertiary} />
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
                <SafeAreaView style={{ flex: 1, backgroundColor: t.color.bg.canvas }} edges={['top', 'left', 'right', 'bottom']}>
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingHorizontal: t.space['4'],
                            paddingVertical: t.space['3'],
                            borderBottomWidth: t.border.default,
                            borderBottomColor: t.color.border.subtle,
                        }}
                    >
                        <Pressable onPress={cerrarDetalle} hitSlop={12}>
                            <Text variant="bodyMd" tone="accent" emphasized>Cerrar</Text>
                        </Pressable>
                        <Text variant="headingSm">Detalle de venta</Text>
                        <View style={{ width: 54 }} />
                    </View>

                    {cargandoDetalle ? (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <ActivityIndicator color={t.color.accent.default} />
                        </View>
                    ) : errorDetalle ? (
                        <Text variant="bodySm" tone="danger" style={{ padding: t.space['4'] }}>{errorDetalle}</Text>
                    ) : detalle ? (
                        <ScrollView contentContainerStyle={{ padding: t.space['4'], paddingBottom: t.space['10'], gap: t.space['3'] }}>
                            <Card variant="subtle" padding={3}>
                                <Text variant="label" tone="tertiary">FECHA</Text>
                                <Text variant="bodyMd" style={{ marginTop: 2 }}>{formatFechaLarga(detalle.fechaHora)}</Text>
                                <View style={{ height: 1, backgroundColor: t.color.border.subtle, marginVertical: t.space['3'] }} />
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <View>
                                        <Text variant="label" tone="tertiary">CANAL</Text>
                                        <Text variant="bodyMd" style={{ marginTop: 2 }}>
                                            {detalle.canal === 'PRESENCIAL' ? 'Presencial' : 'Online'}
                                        </Text>
                                    </View>
                                    <View>
                                        <Text variant="label" tone="tertiary">MEDIO DE PAGO</Text>
                                        <Text variant="bodyMd" style={{ marginTop: 2 }}>
                                            {MEDIO_LABEL[detalle.medioPago] ?? detalle.medioPago}
                                        </Text>
                                    </View>
                                </View>
                                <View style={{ height: 1, backgroundColor: t.color.border.subtle, marginVertical: t.space['3'] }} />
                                <Text variant="label" tone="tertiary">UBICACIÓN</Text>
                                <Text variant="bodyMd" style={{ marginTop: 2 }}>{detalle.ubicacionNombre ?? '—'}</Text>
                            </Card>

                            <Text variant="label" tone="tertiary" style={{ marginTop: t.space['2'] }}>PRODUCTOS</Text>
                            <Card variant="subtle" padding={0}>
                                {detalle.detalles.map((d, idx) => (
                                    <View
                                        key={d.id}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: t.space['3'],
                                            padding: t.space['3'],
                                            borderBottomWidth: idx < detalle.detalles.length - 1 ? t.border.default : 0,
                                            borderBottomColor: t.color.border.subtle,
                                        }}
                                    >
                                        {d.productoImagenUrl ? (
                                            <Image
                                                source={{ uri: d.productoImagenUrl }}
                                                style={{ width: 40, height: 40, borderRadius: t.radius.sm }}
                                                contentFit="cover"
                                            />
                                        ) : (
                                            <View
                                                style={{
                                                    width: 40,
                                                    height: 40,
                                                    borderRadius: t.radius.sm,
                                                    backgroundColor: t.color.bg.sunken,
                                                    borderWidth: t.border.default,
                                                    borderColor: t.color.border.subtle,
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                <Text variant="bodyMd" tone="tertiary" emphasized>
                                                    {d.productoNombre.charAt(0).toUpperCase()}
                                                </Text>
                                            </View>
                                        )}
                                        <View style={{ flex: 1 }}>
                                            <Text variant="bodyMd" emphasized numberOfLines={2}>{d.productoNombre}</Text>
                                            <Text variant="monoSm" tone="tertiary" tabular style={{ marginTop: 2 }}>
                                                {d.cantidad} × {formatCLP(d.precioVentaFinalUnitario)}
                                            </Text>
                                        </View>
                                        <Text variant="monoMd" tabular emphasized>{formatCLP(d.totalBruto)}</Text>
                                    </View>
                                ))}
                            </Card>

                            <Card variant="subtle" padding={3}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                    <Text variant="headingSm">Total</Text>
                                    <Text variant="displayMd" tabular style={{ fontFamily: t.font.mono, color: t.color.accent.default }}>
                                        {formatCLP(detalle.totalBruto)}
                                    </Text>
                                </View>
                                {detalle.montoRecibido != null ? (
                                    <>
                                        <View style={{ height: 1, backgroundColor: t.color.border.subtle, marginVertical: t.space['3'] }} />
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text variant="bodySm" tone="secondary">Recibido</Text>
                                            <Text variant="monoMd" tabular>{formatCLP(detalle.montoRecibido)}</Text>
                                        </View>
                                        {detalle.vuelto != null ? (
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: t.space['1'] }}>
                                                <Text variant="bodySm" tone="secondary">Vuelto</Text>
                                                <Text variant="monoMd" tabular>{formatCLP(detalle.vuelto)}</Text>
                                            </View>
                                        ) : null}
                                    </>
                                ) : null}
                            </Card>
                        </ScrollView>
                    ) : null}
                </SafeAreaView>
            </Modal>
        </Screen>
    );
}
