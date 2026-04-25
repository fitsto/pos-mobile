/**
 * Detalle de producto con tabs internas.
 *
 * Tabs: Info · Variantes · Stock · Historial.
 *
 * La tab Info permite editar toda la información del producto:
 *   - Foto principal (camera / galería)
 *   - Nombre, descripción
 *   - SKU, código de barras
 *   - Costo neto
 *   - Precio de venta con desglose IVA + ganancia (monto y %)
 *   - Toggle "En oferta" → precio oferta con su propio desglose
 *
 * Las otras tres tabs tienen EmptyState con CTA al flujo existente hasta que
 * se construyan sus vistas dedicadas.
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import type { Producto } from '../../src/contexts/producto/domain/Producto';
import { ImagenProductoPicker } from '../../src/runtime/components/ImagenProductoPicker';
import {
    Badge,
    Button,
    Card,
    Chip,
    EmptyState,
    Screen,
    Text,
    TextField,
} from '../../src/runtime/components/ui';
import { container } from '../../src/runtime/di/container';
import { useSesionStore } from '../../src/runtime/stores/SesionStore';
import { useTheme } from '../../src/runtime/theme/ThemeProvider';
import { formatCLP } from '../../src/runtime/utils/formato';
import { desglosarPrecio } from '../../src/runtime/utils/precio';

type Tab = 'info' | 'variantes' | 'stock' | 'historial';

const TABS: { key: Tab; label: string }[] = [
    { key: 'info', label: 'Info' },
    { key: 'variantes', label: 'Variantes' },
    { key: 'stock', label: 'Stock' },
    { key: 'historial', label: 'Historial' },
];

export default function ProductoDetalleScreen() {
    const t = useTheme();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const sesion = useSesionStore((s) => s.sesion);
    const negocio = useSesionStore((s) => s.negocio);
    const puedeGestionar = negocio?.puedeGestionarStock ?? false;
    const iva = negocio?.impuestoVentaPorcentaje ?? 19;

    const [producto, setProducto] = useState<Producto | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>('info');

    // Form state — se hidrata al cargar el producto.
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [sku, setSku] = useState('');
    const [codigoBarras, setCodigoBarras] = useState('');
    const [costo, setCosto] = useState('');
    const [precio, setPrecio] = useState('');
    const [ofertaActivada, setOfertaActivada] = useState(false);
    const [precioOferta, setPrecioOferta] = useState('');
    const [imagenUrl, setImagenUrl] = useState<string | null>(null);
    const [dirty, setDirty] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [eliminando, setEliminando] = useState(false);
    const [ok, setOk] = useState<string | null>(null);

    // Stock por ubicación — se carga al entrar a la pestaña Stock para no
    // pegarle al backend si el operario nunca abre esa tab.
    const [stockPorUbicacion, setStockPorUbicacion] = useState<
        { ubicacionId: string; ubicacionNombre: string; cantidad: number }[] | null
    >(null);
    const [cargandoStock, setCargandoStock] = useState(false);

    const cargar = useCallback(async () => {
        if (!sesion || !negocio || !id) return;
        setCargando(true);
        setError(null);
        try {
            const p = await container.obtenerProducto.execute({
                negocioId: negocio.id,
                productoId: id,
                token: sesion.token,
            });
            setProducto(p);
            const data = p.toJSON();
            setNombre(data.nombre);
            setDescripcion(data.descripcion ?? '');
            setSku(data.sku ?? '');
            setCodigoBarras(data.codigoBarras ?? '');
            setCosto(String(Math.round(data.costoNetoUnitario)));
            setPrecio(String(Math.round(data.precioVentaFinalUnitario)));
            setOfertaActivada(data.precioOferta != null);
            setPrecioOferta(data.precioOferta != null ? String(Math.round(data.precioOferta)) : '');
            setImagenUrl(data.imagenUrl);
            setDirty(false);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo cargar el producto');
        } finally {
            setCargando(false);
        }
    }, [sesion, negocio, id]);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    // Carga lazy del stock al cambiar a la tab Stock. Se vuelve a pedir cada
    // vez que se entra para que refleje ajustes hechos desde otra pantalla.
    useEffect(() => {
        if (tab !== 'stock' || !sesion || !negocio || !id) return;
        let cancelado = false;
        setCargandoStock(true);
        Promise.all([
            container.listarStockPorProducto.execute({
                negocioId: negocio.id,
                productoId: id,
                token: sesion.token,
            }),
            container.listarUbicaciones.execute({
                negocioId: negocio.id,
                token: sesion.token,
            }),
        ])
            .then(([stocks, ubicaciones]) => {
                if (cancelado) return;
                const ubicById = new Map(ubicaciones.map((u) => [u.id, u.nombre]));
                // Sumamos cantidades por ubicación (un mismo producto con
                // variantes puede tener varias filas en la misma ubicación).
                const acumulado = new Map<string, number>();
                for (const s of stocks) {
                    acumulado.set(s.ubicacionId, (acumulado.get(s.ubicacionId) ?? 0) + s.cantidad);
                }
                const filas = Array.from(acumulado.entries()).map(([ubicacionId, cantidad]) => ({
                    ubicacionId,
                    ubicacionNombre: ubicById.get(ubicacionId) ?? 'Ubicación desconocida',
                    cantidad,
                }));
                // Ordenamos por nombre para que la lista sea estable.
                filas.sort((a, b) => a.ubicacionNombre.localeCompare(b.ubicacionNombre));
                setStockPorUbicacion(filas);
            })
            .catch(() => {
                if (!cancelado) setStockPorUbicacion([]);
            })
            .finally(() => {
                if (!cancelado) setCargandoStock(false);
            });
        return () => {
            cancelado = true;
        };
    }, [tab, sesion, negocio, id]);

    useEffect(() => {
        if (!ok) return;
        const h = setTimeout(() => setOk(null), 2500);
        return () => clearTimeout(h);
    }, [ok]);

    const costoNum = Number(costo) || 0;
    const precioNum = Number(precio) || 0;
    const ofertaNum = Number(precioOferta) || 0;

    const desgloseVenta = useMemo(
        () => desglosarPrecio(precioNum, costoNum, iva),
        [precioNum, costoNum, iva],
    );
    const desgloseOferta = useMemo(
        () => (ofertaActivada && ofertaNum > 0
            ? desglosarPrecio(ofertaNum, costoNum, iva)
            : null),
        [ofertaActivada, ofertaNum, costoNum, iva],
    );

    const guardar = async () => {
        if (!sesion || !negocio || !producto) return;
        if (!nombre.trim()) {
            setError('El nombre no puede estar vacío');
            return;
        }
        if (!Number.isFinite(precioNum) || precioNum < 0) {
            setError('Precio inválido');
            return;
        }
        if (ofertaActivada && ofertaNum >= precioNum) {
            setError('El precio de oferta debe ser menor al precio de venta');
            return;
        }
        setError(null);
        setGuardando(true);
        try {
            const actualizado = await container.actualizarProducto.execute({
                negocioId: negocio.id,
                productoId: producto.id,
                token: sesion.token,
                nombre: nombre.trim(),
                descripcion: descripcion.trim() || null,
                sku: sku.trim() || null,
                codigoBarras: codigoBarras.trim() || null,
                costoNetoUnitario: costoNum,
                precioVentaFinalUnitario: precioNum,
                precioOferta: ofertaActivada && ofertaNum > 0 ? ofertaNum : null,
            });
            setProducto(actualizado);
            setDirty(false);
            setOk('Guardado');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al guardar');
        } finally {
            setGuardando(false);
        }
    };

    const reactivar = async () => {
        if (!sesion || !negocio || !producto) return;
        setEliminando(true);
        try {
            await container.activarProducto.execute({
                negocioId: negocio.id,
                productoId: producto.id,
                token: sesion.token,
            });
            await cargar();
            setOk('Producto reactivado');
        } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo reactivar');
        } finally {
            setEliminando(false);
        }
    };

    const confirmarEliminar = () => {
        if (!sesion || !negocio || !producto) return;
        Alert.alert(
            'Eliminar producto',
            `¿Seguro que quieres eliminar "${producto.nombre}"? Dejará de aparecer en el catálogo y en búsquedas. El historial de ventas no se pierde.`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        setEliminando(true);
                        try {
                            await container.desactivarProducto.execute({
                                negocioId: negocio.id,
                                productoId: producto.id,
                                token: sesion.token,
                            });
                            router.back();
                        } catch (e) {
                            setEliminando(false);
                            Alert.alert(
                                'Error',
                                e instanceof Error ? e.message : 'No se pudo eliminar el producto',
                            );
                        }
                    },
                },
            ],
        );
    };

    const marcarDirty = <T,>(setter: (v: T) => void) => (v: T) => {
        setter(v);
        setDirty(true);
    };

    const onlyDigits = (v: string) => v.replace(/[^\d]/g, '');

    if (cargando) {
        return (
            <Screen title="Cargando…" onBack={() => router.back()}>
                <View style={{ alignItems: 'center', marginTop: t.space['8'] }}>
                    <ActivityIndicator color={t.color.accent.default} />
                </View>
            </Screen>
        );
    }

    if (error && !producto) {
        return (
            <Screen title="Error" onBack={() => router.back()}>
                <EmptyState
                    icon={<Ionicons name="alert-circle-outline" size={48} color={t.color.feedback.dangerFg} />}
                    title="No se pudo cargar"
                    description={error}
                    actionLabel="Reintentar"
                    onAction={cargar}
                />
            </Screen>
        );
    }

    if (!producto) return null;

    return (
        <Screen
            paddingH={0}
            title={producto.nombre}
            subtitle={producto.sku ? `SKU ${producto.sku}` : undefined}
            onBack={() => router.back()}
            footer={
                tab === 'info' && puedeGestionar ? (
                    <Button
                        label="Guardar cambios"
                        onPress={guardar}
                        disabled={!dirty || guardando}
                        loading={guardando}
                        size="lg"
                        fullWidth
                    />
                ) : undefined
            }
        >
            <View
                style={{
                    flexDirection: 'row',
                    gap: t.space['2'],
                    paddingHorizontal: t.space['4'],
                    marginBottom: t.space['3'],
                }}
            >
                {TABS.map((x) => (
                    <Chip
                        key={x.key}
                        label={x.label}
                        selected={tab === x.key}
                        onPress={() => setTab(x.key)}
                    />
                ))}
            </View>

            <ScrollView
                contentContainerStyle={{
                    paddingHorizontal: t.space['4'],
                    paddingBottom: t.space['8'],
                    gap: t.space['3'],
                }}
                keyboardShouldPersistTaps="handled"
            >
                {tab === 'info' ? (
                    <>
                        {sesion ? (
                            <ImagenProductoPicker
                                negocioId={negocio!.id}
                                productoId={producto.id}
                                token={sesion.token}
                                imagenUrl={imagenUrl}
                                onUploaded={(url) => {
                                    setImagenUrl(url);
                                    void cargar();
                                }}
                                editable={puedeGestionar}
                            />
                        ) : null}

                        <TextField
                            label="Nombre"
                            value={nombre}
                            onChangeText={marcarDirty(setNombre)}
                            editable={puedeGestionar}
                        />
                        <TextField
                            label="Descripción"
                            value={descripcion}
                            onChangeText={marcarDirty(setDescripcion)}
                            placeholder="Breve descripción del producto…"
                            multiline
                            numberOfLines={3}
                            editable={puedeGestionar}
                            inputStyle={{ minHeight: 72, textAlignVertical: 'top' }}
                        />
                        <TextField
                            label="SKU"
                            value={sku}
                            onChangeText={marcarDirty(setSku)}
                            placeholder="Opcional"
                            mono
                            editable={puedeGestionar}
                        />
                        <TextField
                            label="Código de barras"
                            value={codigoBarras}
                            onChangeText={marcarDirty(setCodigoBarras)}
                            placeholder="EAN / UPC"
                            mono
                            keyboardType="number-pad"
                            editable={puedeGestionar}
                        />

                        {/* Costo */}
                        <TextField
                            label="Costo neto unitario"
                            value={costo}
                            onChangeText={(v) => marcarDirty(setCosto)(onlyDigits(v))}
                            placeholder="0"
                            keyboardType="number-pad"
                            mono
                            helper="Lo que te cuesta comprar el producto (sin IVA). No se muestra al cliente."
                            editable={puedeGestionar}
                        />

                        {/* Precio venta + desglose */}
                        <TextField
                            label="Precio de venta (con IVA)"
                            value={precio}
                            onChangeText={(v) => marcarDirty(setPrecio)(onlyDigits(v))}
                            placeholder="0"
                            keyboardType="number-pad"
                            mono
                            editable={puedeGestionar}
                        />
                        <DesgloseCard desglose={desgloseVenta} iva={iva} costoNum={costoNum} />

                        {/* Toggle oferta */}
                        <ToggleRow
                            activa={ofertaActivada}
                            label="Activar precio de oferta"
                            onToggle={() => {
                                marcarDirty(setOfertaActivada)(!ofertaActivada);
                            }}
                            disabled={!puedeGestionar}
                        />

                        {ofertaActivada ? (
                            <>
                                <TextField
                                    label="Precio oferta (con IVA)"
                                    value={precioOferta}
                                    onChangeText={(v) => marcarDirty(setPrecioOferta)(onlyDigits(v))}
                                    placeholder="0"
                                    keyboardType="number-pad"
                                    mono
                                    editable={puedeGestionar}
                                    helper={
                                        ofertaNum > 0 && ofertaNum >= precioNum
                                            ? 'La oferta debe ser menor al precio normal.'
                                            : undefined
                                    }
                                />
                                {desgloseOferta ? (
                                    <DesgloseCard
                                        desglose={desgloseOferta}
                                        iva={iva}
                                        costoNum={costoNum}
                                        acento
                                    />
                                ) : null}
                            </>
                        ) : null}

                        {error ? (
                            <Text variant="bodySm" tone="danger">{error}</Text>
                        ) : null}
                        {ok ? (
                            <Badge
                                tone="success"
                                variant="soft"
                                label={ok}
                                style={{ alignSelf: 'flex-start' }}
                            />
                        ) : null}

                        {puedeGestionar ? (
                            producto.activo ? (
                                <View
                                    style={{
                                        marginTop: t.space['6'],
                                        paddingTop: t.space['4'],
                                        borderTopWidth: t.border.default,
                                        borderTopColor: t.color.border.subtle,
                                        gap: t.space['2'],
                                    }}
                                >
                                    <Text variant="label" tone="tertiary">
                                        ZONA DE PELIGRO
                                    </Text>
                                    <Text variant="bodySm" tone="secondary">
                                        Al eliminar, el producto desaparece del catálogo pero el historial de ventas se mantiene. Podrás reactivarlo luego.
                                    </Text>
                                    <Pressable
                                        onPress={confirmarEliminar}
                                        disabled={eliminando}
                                        style={({ pressed }) => ({
                                            marginTop: t.space['2'],
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: t.space['2'],
                                            paddingVertical: t.space['3'],
                                            paddingHorizontal: t.space['4'],
                                            borderRadius: t.radius.lg,
                                            borderWidth: t.border.default,
                                            borderColor: t.color.feedback.dangerFg,
                                            backgroundColor: pressed
                                                ? t.color.feedback.dangerBg
                                                : 'transparent',
                                            opacity: eliminando ? 0.5 : 1,
                                        })}
                                    >
                                        <Ionicons
                                            name="trash-outline"
                                            size={18}
                                            color={t.color.feedback.dangerFg}
                                        />
                                        <Text
                                            variant="bodyMd"
                                            emphasized
                                            style={{ color: t.color.feedback.dangerFg }}
                                        >
                                            {eliminando ? 'Eliminando…' : 'Eliminar producto'}
                                        </Text>
                                    </Pressable>
                                </View>
                            ) : (
                                <View
                                    style={{
                                        marginTop: t.space['6'],
                                        paddingTop: t.space['4'],
                                        borderTopWidth: t.border.default,
                                        borderTopColor: t.color.border.subtle,
                                        gap: t.space['2'],
                                    }}
                                >
                                    <Badge
                                        tone="warning"
                                        variant="soft"
                                        label="Producto inactivo"
                                        style={{ alignSelf: 'flex-start' }}
                                    />
                                    <Text variant="bodySm" tone="secondary">
                                        Este producto está oculto del catálogo. Reactívalo para volver a venderlo.
                                    </Text>
                                    <Pressable
                                        onPress={reactivar}
                                        disabled={eliminando}
                                        style={({ pressed }) => ({
                                            marginTop: t.space['2'],
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: t.space['2'],
                                            paddingVertical: t.space['3'],
                                            paddingHorizontal: t.space['4'],
                                            borderRadius: t.radius.lg,
                                            borderWidth: t.border.default,
                                            borderColor: t.color.accent.default,
                                            backgroundColor: pressed
                                                ? t.color.accent.soft
                                                : 'transparent',
                                            opacity: eliminando ? 0.5 : 1,
                                        })}
                                    >
                                        <Ionicons
                                            name="refresh"
                                            size={18}
                                            color={t.color.accent.default}
                                        />
                                        <Text
                                            variant="bodyMd"
                                            emphasized
                                            style={{ color: t.color.accent.default }}
                                        >
                                            {eliminando ? 'Reactivando…' : 'Reactivar producto'}
                                        </Text>
                                    </Pressable>
                                </View>
                            )
                        ) : null}
                    </>
                ) : tab === 'variantes' ? (
                    <EmptyState
                        icon={<Ionicons name="layers-outline" size={48} color={t.color.fg.tertiary} />}
                        title="Variantes"
                        description="Próximamente podrás administrar modelos y tallas desde acá."
                    />
                ) : tab === 'stock' ? (
                    cargandoStock ? (
                        <View style={{ paddingVertical: t.space['8'], alignItems: 'center' }}>
                            <ActivityIndicator color={t.color.accent.default} />
                        </View>
                    ) : (
                        <View style={{ gap: t.space['3'] }}>
                            <Card variant="subtle" padding={3}>
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                    }}
                                >
                                    <Text variant="headingSm">Stock total</Text>
                                    <Text variant="monoLg" tabular emphasized>
                                        {(stockPorUbicacion ?? []).reduce((a, s) => a + s.cantidad, 0)}
                                    </Text>
                                </View>
                            </Card>

                            {stockPorUbicacion && stockPorUbicacion.length > 0 ? (
                                <View
                                    style={{
                                        borderRadius: t.radius.lg,
                                        borderWidth: t.border.default,
                                        borderColor: t.color.border.subtle,
                                        backgroundColor: t.color.bg.raised,
                                        overflow: 'hidden',
                                    }}
                                >
                                    {stockPorUbicacion.map((s, idx) => (
                                        <View
                                            key={s.ubicacionId}
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                paddingHorizontal: t.space['4'],
                                                paddingVertical: t.space['3'],
                                                borderTopWidth:
                                                    idx === 0 ? 0 : t.border.default,
                                                borderTopColor: t.color.border.subtle,
                                            }}
                                        >
                                            <View
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    gap: t.space['2'],
                                                    flex: 1,
                                                }}
                                            >
                                                <Ionicons
                                                    name="location-outline"
                                                    size={18}
                                                    color={t.color.fg.tertiary}
                                                />
                                                <Text variant="bodyMd" numberOfLines={1}>
                                                    {s.ubicacionNombre}
                                                </Text>
                                            </View>
                                            <Text
                                                variant="monoMd"
                                                tabular
                                                emphasized
                                                tone={s.cantidad <= 0 ? 'danger' : 'primary'}
                                            >
                                                {s.cantidad}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <Card variant="subtle" padding={4}>
                                    <Text variant="bodyMd" tone="secondary" align="center">
                                        Aún no hay stock registrado para este producto.
                                    </Text>
                                </Card>
                            )}

                            {puedeGestionar ? (
                                <Button
                                    variant="primary"
                                    size="lg"
                                    label="Ir a ajuste de stock"
                                    leadingIcon={
                                        <Ionicons
                                            name="swap-vertical"
                                            size={18}
                                            color={t.color.fg.onAccent}
                                        />
                                    }
                                    onPress={() => router.push('/producto/ajustar')}
                                    fullWidth
                                />
                            ) : null}
                        </View>
                    )
                ) : (
                    <EmptyState
                        icon={<Ionicons name="time-outline" size={48} color={t.color.fg.tertiary} />}
                        title="Historial"
                        description="Muy pronto: movimientos de stock, ventas y ajustes del producto."
                    />
                )}
            </ScrollView>
        </Screen>
    );
}

/**
 * Card con el desglose de precio final: IVA + neto + costo + ganancia/margen.
 * Se esconde sola si no hay precio (evita mostrar ceros sin contexto).
 */
function DesgloseCard({
    desglose,
    iva,
    costoNum,
    acento,
}: {
    desglose: ReturnType<typeof desglosarPrecio>;
    iva: number;
    costoNum: number;
    acento?: boolean;
}) {
    const t = useTheme();
    if (desglose.precioFinal <= 0) return null;

    const perdida = desglose.ganancia < 0;
    const colorGanancia = perdida ? t.color.feedback.dangerFg : t.color.feedback.successFg;

    return (
        <Card
            variant={acento ? 'outline' : 'subtle'}
            padding={3}
            style={
                acento
                    ? { borderColor: t.color.accent.default }
                    : undefined
            }
        >
            <Row label={`IVA (${iva}%)`} valor={formatCLP(desglose.ivaMonto)} />
            <Row label="Precio neto (sin IVA)" valor={formatCLP(desglose.precioNeto)} />
            {costoNum > 0 ? (
                <>
                    <Row label="Tu costo" valor={formatCLP(costoNum)} />
                    <View
                        style={{
                            height: 1,
                            backgroundColor: t.color.border.subtle,
                            marginVertical: t.space['2'],
                        }}
                    />
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'baseline',
                            justifyContent: 'space-between',
                        }}
                    >
                        <Text variant="label" tone={perdida ? 'danger' : 'success'}>
                            {perdida ? 'PÉRDIDA' : 'GANANCIA'}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space['2'] }}>
                            <Text
                                variant="headingLg"
                                style={{ color: colorGanancia }}
                            >
                                {formatCLP(desglose.ganancia)}
                            </Text>
                            {desglose.margenPorcentaje != null ? (
                                <Text variant="bodySm" tone="secondary">
                                    ({desglose.margenPorcentaje.toFixed(0)}% s/costo)
                                </Text>
                            ) : null}
                        </View>
                    </View>
                </>
            ) : (
                <Text variant="bodySm" tone="tertiary" style={{ marginTop: t.space['1'] }}>
                    Agrega el costo para ver tu ganancia.
                </Text>
            )}
        </Card>
    );
}

function Row({ label, valor }: { label: string; valor: string }) {
    const t = useTheme();
    return (
        <View
            style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                paddingVertical: 2,
            }}
        >
            <Text variant="bodySm" tone="secondary">{label}</Text>
            <Text variant="monoMd" tabular style={{ color: t.color.fg.primary }}>
                {valor}
            </Text>
        </View>
    );
}

function ToggleRow({
    activa,
    label,
    onToggle,
    disabled,
}: {
    activa: boolean;
    label: string;
    onToggle: () => void;
    disabled?: boolean;
}) {
    const t = useTheme();
    return (
        <Pressable
            onPress={disabled ? undefined : onToggle}
            disabled={disabled}
            style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: t.space['4'],
                paddingVertical: t.space['3'],
                borderRadius: t.radius.lg,
                borderWidth: t.border.default,
                borderColor: activa ? t.color.accent.default : t.color.border.subtle,
                backgroundColor: activa
                    ? t.color.accent.soft
                    : pressed
                        ? t.color.bg.sunken
                        : t.color.bg.raised,
                opacity: disabled ? 0.5 : 1,
            })}
        >
            <Text variant="bodyMd" emphasized>{label}</Text>
            <View
                style={{
                    width: 44,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: activa ? t.color.accent.default : t.color.border.subtle,
                    padding: 2,
                    justifyContent: 'center',
                }}
            >
                <View
                    style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: '#fff',
                        transform: [{ translateX: activa ? 18 : 0 }],
                    }}
                />
            </View>
        </Pressable>
    );
}
