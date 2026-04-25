/**
 * Stock: listado por ubicación + registro de ajuste (+/-) con motivo.
 * Reutiliza ScannerModal + SelectorVarianteModal. Soporta offline vía executeOrEnqueue.
 */
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    View,
} from 'react-native';
import {
    MOTIVOS_AJUSTE,
    MotivoAjuste,
    etiquetaMotivo,
} from '../../src/contexts/ajuste-inventario/domain/MotivoAjuste';
import type { Producto } from '../../src/contexts/producto/domain/Producto';
import type { Ubicacion } from '../../src/contexts/ubicacion/domain/Ubicacion';
import type { VarianteInfo } from '../../src/contexts/venta/domain/ItemCarrito';
import { OfflineBanner } from '../../src/runtime/components/OfflineBanner';
import { ScannerModal } from '../../src/runtime/components/ScannerModal';
import { SelectorVarianteModal } from '../../src/runtime/components/SelectorVarianteModal';
import {
    Badge,
    Button,
    Card,
    Chip,
    IconButton,
    Screen,
    Text,
    TextField,
} from '../../src/runtime/components/ui';
import { container } from '../../src/runtime/di/container';
import { executeOrEnqueue } from '../../src/runtime/offline/OfflineQueueManager';
import { useOfflineQueueStore } from '../../src/runtime/stores/OfflineQueueStore';
import { useSesionStore } from '../../src/runtime/stores/SesionStore';
import { useTheme } from '../../src/runtime/theme/ThemeProvider';
import { formatCLP } from '../../src/runtime/utils/formato';

interface StockRowUI {
    producto: Producto;
    cantidad: number;
    varianteId: string | null;
    varianteTalla: string | null;
    modeloNombre: string | null;
}

function varianteLabel(modelo: string | null, talla: string | null): string | null {
    const parts: string[] = [];
    if (modelo) parts.push(modelo);
    if (talla) parts.push(talla);
    return parts.length ? parts.join(' · ') : null;
}

export default function StockScreen() {
    const t = useTheme();
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

    const [query, setQuery] = useState('');
    const [resultados, setResultados] = useState<Producto[]>([]);
    const [seleccionado, setSeleccionado] = useState<Producto | null>(null);
    const [varianteSeleccionada, setVarianteSeleccionada] = useState<VarianteInfo | null>(null);
    const [selectorVisible, setSelectorVisible] = useState(false);
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
        return () => {
            cancel = true;
        };
    }, [sesion, negocio, esVendedor]);

    const cargarStock = async () => {
        if (!sesion || !negocio || !ubicacionId) {
            setStockItems([]);
            return;
        }
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
                    return (
                        (a.modeloNombre ?? '').localeCompare(b.modeloNombre ?? '') ||
                        (a.varianteTalla ?? '').localeCompare(b.varianteTalla ?? '')
                    );
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ubicacionId, sesion, negocio]);

    useEffect(() => {
        if (!exito) return;
        const h = setTimeout(() => setExito(null), 3000);
        return () => clearTimeout(h);
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
        if (!sesion || !negocio || !texto.trim()) {
            setResultados([]);
            return;
        }
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
        } finally {
            setBuscando(false);
        }
    };

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
            if (exacto) await elegirProducto(exacto);
            else setError(`No se encontró producto con código ${codigo}`);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al buscar');
        }
    };

    const tieneVariantesSeleccionado = seleccionado ? productosConVariantes.has(seleccionado.id) : false;
    const requiereVariante = tieneVariantesSeleccionado && !varianteSeleccionada;

    const registrar = async () => {
        if (!sesion || !negocio || !seleccionado || !ubicacionId) return;
        if (requiereVariante) {
            setError('Este producto tiene variantes. Elige una antes de registrar el ajuste.');
            return;
        }
        const abs = Number((cantidad.replace(/[^\d]/g, '').replace(/^0+/, '') || '0'));
        if (!abs) return;
        setError(null);
        setExito(null);
        setEnviando(true);
        try {
            const vlabel = varianteLabel(
                varianteSeleccionada?.modeloNombre ?? null,
                varianteSeleccionada?.talla ?? null,
            );
            const etiqueta = vlabel ? `${seleccionado.nombre} · ${vlabel}` : seleccionado.nombre;
            const cantidadFinal = signo === '+' ? abs : -abs;

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

            setExito(
                result.executedOnline
                    ? `Ajuste registrado: ${signo}${abs} ${etiqueta}`
                    : `Ajuste guardado sin conexión. Se sincronizará cuando haya red. (${signo}${abs} ${etiqueta})`,
            );

            setSeleccionado(null);
            setVarianteSeleccionada(null);
            setCantidad('');
            setComentario('');

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
        } finally {
            setEnviando(false);
        }
    };

    // Guards
    if (!puede) {
        return (
            <Screen title="Stock">
                <Text variant="bodyMd" tone="secondary">No tienes permisos para gestionar stock.</Text>
            </Screen>
        );
    }
    if (esVendedor && !ubicacionId) {
        return (
            <Screen title="Stock">
                <Text variant="bodyMd" tone="secondary">No tienes una ubicación asignada.</Text>
            </Screen>
        );
    }
    if (!esVendedor && ubicaciones.length === 0) {
        return (
            <Screen title="Stock">
                <Text variant="bodyMd" tone="secondary">Aún no hay ubicaciones creadas en el negocio.</Text>
            </Screen>
        );
    }
    if (!ubicacionId) {
        return (
            <Screen title="Stock">
                <View style={{ alignItems: 'center', marginTop: t.space['8'] }}>
                    <ActivityIndicator color={t.color.accent.default} />
                </View>
            </Screen>
        );
    }

    const selVarLabel = varianteLabel(
        varianteSeleccionada?.modeloNombre ?? null,
        varianteSeleccionada?.talla ?? null,
    );

    return (
        <Screen
            paddingH={0}
            title="Ajuste de stock"
            subtitle={ubicacionNombre ?? undefined}
            onBack={seleccionado ? () => {
                setSeleccionado(null);
                setVarianteSeleccionada(null);
            } : undefined}
        >
            <ScrollView
                contentContainerStyle={{
                    paddingHorizontal: t.space['4'],
                    paddingBottom: t.space['8'],
                    gap: t.space['3'],
                }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.color.accent.default} />
                }
            >
                <OfflineBanner />

                {!esVendedor && ubicaciones.length > 1 ? (
                    <View style={{ flexDirection: 'row', gap: t.space['2'], flexWrap: 'wrap' }}>
                        {ubicaciones.map((u) => (
                            <Chip
                                key={u.id}
                                label={`${u.nombre} · ${u.tipo === 'SUCURSAL' ? 'Sucursal' : 'Bodega'}`}
                                selected={ubicacionId === u.id}
                                onPress={() => {
                                    setUbicacionId(u.id);
                                    setSeleccionado(null);
                                    setVarianteSeleccionada(null);
                                }}
                            />
                        ))}
                    </View>
                ) : null}

                {!seleccionado ? (
                    <>
                        <View style={{ flexDirection: 'row', gap: t.space['2'], alignItems: 'flex-end' }}>
                            <View style={{ flex: 1 }}>
                                <TextField
                                    placeholder="Buscar producto…"
                                    value={query}
                                    onChangeText={(txt) => {
                                        setQuery(txt);
                                        buscar(txt);
                                    }}
                                    leadingIcon={<Ionicons name="search" size={18} color={t.color.fg.tertiary} />}
                                />
                            </View>
                            <IconButton
                                variant="solid"
                                size="lg"
                                accessibilityLabel="Escanear"
                                icon={<Ionicons name="barcode-outline" size={22} color={t.color.fg.onAccent} />}
                                onPress={() => setScannerVisible(true)}
                            />
                        </View>

                        {buscando ? (
                            <ActivityIndicator color={t.color.accent.default} />
                        ) : null}

                        {resultados.slice(0, 8).map((p) => {
                            const cargandoEste = resolviendoProducto === p.id;
                            const tieneVar = productosConVariantes.has(p.id);
                            return (
                                <Pressable
                                    key={p.id}
                                    onPress={() => elegirProducto(p)}
                                    disabled={cargandoEste}
                                    style={({ pressed }) => ({
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        paddingVertical: t.space['3'],
                                        borderBottomWidth: t.border.default,
                                        borderBottomColor: t.color.border.subtle,
                                        gap: t.space['2'],
                                        backgroundColor: pressed ? t.color.bg.sunken : 'transparent',
                                    })}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text variant="bodyMd" emphasized>{p.nombre}</Text>
                                        <Text variant="bodySm" tone="tertiary">
                                            {p.sku ? `SKU ${p.sku}` : '—'}
                                            {tieneVar ? ' · Con variantes' : ''}
                                        </Text>
                                    </View>
                                    {cargandoEste ? (
                                        <ActivityIndicator color={t.color.accent.default} />
                                    ) : (
                                        <Text variant="monoMd" tabular emphasized>{formatCLP(p.precio)}</Text>
                                    )}
                                </Pressable>
                            );
                        })}

                        {query.trim().length === 0 ? (
                            <>
                                <Text variant="label" tone="tertiary" style={{ marginTop: t.space['3'] }}>
                                    STOCK ACTUAL · {stockItems.length}
                                </Text>
                                {cargandoStock ? (
                                    <ActivityIndicator color={t.color.accent.default} />
                                ) : stockItems.length === 0 ? (
                                    <Text variant="bodySm" tone="tertiary">
                                        Sin stock registrado en esta ubicación.
                                    </Text>
                                ) : (
                                    stockItems.map((row) => {
                                        const varLabel = varianteLabel(row.modeloNombre, row.varianteTalla);
                                        const key = row.varianteId
                                            ? `${row.producto.id}:${row.varianteId}`
                                            : row.producto.id;
                                        return (
                                            <Pressable
                                                key={key}
                                                onPress={() => elegirFilaStock(row)}
                                                style={({ pressed }) => ({
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    paddingVertical: t.space['3'],
                                                    borderBottomWidth: t.border.default,
                                                    borderBottomColor: t.color.border.subtle,
                                                    gap: t.space['2'],
                                                    backgroundColor: pressed ? t.color.bg.sunken : 'transparent',
                                                })}
                                            >
                                                <View style={{ flex: 1 }}>
                                                    <Text variant="bodyMd" emphasized numberOfLines={1}>
                                                        {row.producto.nombre}
                                                        {varLabel ? ` · ${varLabel}` : ''}
                                                    </Text>
                                                    {row.producto.sku ? (
                                                        <Text variant="monoSm" tone="tertiary">SKU {row.producto.sku}</Text>
                                                    ) : null}
                                                </View>
                                                <Text
                                                    variant="monoLg"
                                                    tabular
                                                    emphasized
                                                    tone={row.cantidad <= 0 ? 'danger' : 'accent'}
                                                >
                                                    {row.cantidad}
                                                </Text>
                                            </Pressable>
                                        );
                                    })
                                )}
                            </>
                        ) : null}
                    </>
                ) : (
                    <Card variant="subtle" padding={4}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: t.space['3'] }}>
                            <View style={{ flex: 1 }}>
                                <Text variant="headingSm">{seleccionado.nombre}</Text>
                                {selVarLabel ? (
                                    <Text variant="bodySm" tone="accent" style={{ marginTop: 2 }}>
                                        {selVarLabel}
                                    </Text>
                                ) : tieneVariantesSeleccionado ? (
                                    <Text variant="bodySm" tone="danger" style={{ marginTop: 2 }}>
                                        Requiere variante
                                    </Text>
                                ) : seleccionado.sku ? (
                                    <Text variant="monoSm" tone="tertiary" style={{ marginTop: 2 }}>
                                        SKU {seleccionado.sku}
                                    </Text>
                                ) : null}
                            </View>
                            <Pressable
                                onPress={() => {
                                    setSeleccionado(null);
                                    setVarianteSeleccionada(null);
                                }}
                                hitSlop={8}
                            >
                                <Text variant="label" tone="accent">Cambiar</Text>
                            </Pressable>
                        </View>

                        {tieneVariantesSeleccionado ? (
                            <Button
                                variant="secondary"
                                size="md"
                                label={varianteSeleccionada ? 'Cambiar variante' : 'Elegir variante'}
                                onPress={() => setSelectorVisible(true)}
                                fullWidth
                                style={{ marginBottom: t.space['3'] }}
                            />
                        ) : null}

                        <Text variant="label" tone="tertiary">TIPO</Text>
                        <View style={{ flexDirection: 'row', gap: t.space['2'], marginTop: t.space['2'], marginBottom: t.space['3'] }}>
                            {(['-', '+'] as const).map((s) => (
                                <Pressable
                                    key={s}
                                    onPress={() => setSigno(s)}
                                    style={{
                                        flex: 1,
                                        paddingVertical: t.space['3'],
                                        borderRadius: t.radius.md,
                                        borderWidth: t.border.default,
                                        borderColor:
                                            signo === s
                                                ? s === '+'
                                                    ? t.color.feedback.successFg
                                                    : t.color.feedback.dangerFg
                                                : t.color.border.subtle,
                                        backgroundColor:
                                            signo === s
                                                ? s === '+'
                                                    ? t.color.feedback.successBg
                                                    : t.color.feedback.dangerBg
                                                : t.color.bg.raised,
                                        alignItems: 'center',
                                    }}
                                >
                                    <Text
                                        variant="bodyMd"
                                        emphasized
                                        tone={
                                            signo === s ? (s === '+' ? 'success' : 'danger') : 'secondary'
                                        }
                                    >
                                        {s === '+' ? 'Entrada (+)' : 'Salida (−)'}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>

                        <TextField
                            label="Cantidad"
                            placeholder="0"
                            value={cantidad}
                            onChangeText={(txt) => {
                                const soloDigitos = txt.replace(/[^\d]/g, '');
                                if (soloDigitos === '' || soloDigitos === '0') setCantidad(soloDigitos);
                                else setCantidad(soloDigitos.replace(/^0+/, '') || '0');
                            }}
                            keyboardType="number-pad"
                            mono
                            editable={!requiereVariante}
                            inputStyle={{ fontSize: 24, fontFamily: t.font.mono }}
                            style={{ marginBottom: t.space['3'] }}
                        />

                        <Text variant="label" tone="tertiary">MOTIVO</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: t.space['2'], paddingVertical: t.space['2'] }}
                        >
                            {MOTIVOS_AJUSTE.map((m) => (
                                <Chip
                                    key={m}
                                    label={etiquetaMotivo[m]}
                                    selected={motivo === m}
                                    onPress={() => setMotivo(m)}
                                />
                            ))}
                        </ScrollView>

                        <TextField
                            label="Comentario (opcional)"
                            placeholder="Detalle…"
                            value={comentario}
                            onChangeText={setComentario}
                            style={{ marginTop: t.space['2'], marginBottom: t.space['4'] }}
                        />

                        <Button
                            label="Registrar ajuste"
                            onPress={registrar}
                            disabled={!cantidad || enviando || requiereVariante}
                            loading={enviando}
                            size="lg"
                            fullWidth
                        />
                    </Card>
                )}

                {error ? <Text variant="bodySm" tone="danger">{error}</Text> : null}
                {exito ? (
                    <Badge tone="success" variant="soft" label={exito} style={{ alignSelf: 'flex-start' }} />
                ) : null}
            </ScrollView>

            <ScannerModal visible={scannerVisible} onClose={() => setScannerVisible(false)} onScan={onScan} />
            {sesion && negocio ? (
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
            ) : null}
        </Screen>
    );
}
