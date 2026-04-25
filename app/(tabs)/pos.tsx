/**
 * POS — pantalla de venta presencial.
 *
 * Estructura visual (direction B, Retail preciso):
 *   - Header: nombre del negocio + ubicación actual.
 *   - Chips horizontales de ubicaciones (solo admin/cajero con múltiples).
 *   - Barra de búsqueda + IconButton ESCANEAR.
 *   - Tabs: Carrito / Catálogo.
 *   - Lista (carrito o catálogo).
 *   - Footer sticky con total mono + CTA COBRAR.
 *
 * La lógica de negocio (hooks, handlers, offline queue, optimistic stock)
 * se preserva 1:1 respecto a la versión anterior.
 */
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Keyboard,
    Pressable,
    ScrollView,
    View,
} from 'react-native';
import { Producto } from '../../src/contexts/producto/domain/Producto';
import type { Modelo, Variante } from '../../src/contexts/producto/domain/Variante';
import { DomainError } from '../../src/contexts/shared/domain/DomainError';
import type { Ubicacion } from '../../src/contexts/ubicacion/domain/Ubicacion';
import type { CatalogoProducto } from '../../src/contexts/catalogo-local/domain/CatalogoSnapshot';
import type { VarianteInfo } from '../../src/contexts/venta/domain/ItemCarrito';
import type { MedioPago } from '../../src/contexts/venta/domain/MedioPago';
import { trySyncCatalogo } from '../../src/runtime/catalogo/CatalogoSyncManager';
import { ClienteModal, type ClienteResuelto } from '../../src/runtime/components/ClienteModal';
import { CobroModal } from '../../src/runtime/components/CobroModal';
import { ScannerModal } from '../../src/runtime/components/ScannerModal';
import { SelectorVarianteModal } from '../../src/runtime/components/SelectorVarianteModal';
import {
    Badge,
    Button,
    Card,
    Chip,
    EmptyState,
    IconButton,
    Screen,
    Text,
    TextField,
} from '../../src/runtime/components/ui';
import { container } from '../../src/runtime/di/container';
import { executeOrEnqueue } from '../../src/runtime/offline/OfflineQueueManager';
import { useCarritoStore } from '../../src/runtime/stores/CarritoStore';
import {
    diasDesdeUltimaSync,
    useCatalogoSyncStore,
} from '../../src/runtime/stores/CatalogoSyncStore';
import { useOfflineQueueStore } from '../../src/runtime/stores/OfflineQueueStore';
import { useSesionStore } from '../../src/runtime/stores/SesionStore';
import { useTheme } from '../../src/runtime/theme/ThemeProvider';
import { formatCLP } from '../../src/runtime/utils/formato';

const claveDe = (productoId: string, varianteId: string | null): string =>
    varianteId ? `${productoId}:${varianteId}` : `${productoId}::`;

function toProducto(p: CatalogoProducto): Producto {
    return Producto.create({
        id: p.id,
        nombre: p.nombre,
        descripcion: null,
        codigoBarras: p.codigoBarra,
        sku: p.codigoInterno,
        costoNetoUnitario: 0,
        precioVentaFinalUnitario: p.precioVentaFinal,
        precioVentaNetoUnitario: p.precioVentaFinal,
        precioOferta: p.precioOferta,
        imagenes: [],
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
    const t = useTheme();
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
    const [stockPorVariante, setStockPorVariante] = useState<Map<string, number>>(new Map());
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

    useEffect(() => {
        if (puedeVender) fetchProductos(query);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastSyncAt]);

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

    const onQueryChange = (txt: string) => {
        setQuery(txt);
        // No cambiamos de vista automáticamente: el usuario decide cuándo
        // pasar a catálogo. Esto vale tanto al tipear como al escanear.
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchProductos(txt), 200);
    };

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

    const handleAgregar = (p: Producto, variante: VarianteInfo | null) => {
        setError(null);
        agregar(p, 1, variante);
        Keyboard.dismiss();
    };

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
                const vista: ProductoVista = {
                    producto: toProducto(exacto.producto),
                    raw: exacto.producto,
                    stockAgregado: exacto.stockAgregado,
                    tieneVariantes: exacto.tieneVariantes,
                };
                await abrirProducto(vista);
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
            fetchProductos(query);
        } catch (e) {
            throw e instanceof DomainError || e instanceof Error ? e : new Error('Error desconocido');
        }
    };

    const handleClienteResuelto = (r: ClienteResuelto) => {
        setClienteModalVisible(false);
        setClienteResuelto(r.tipo === 'skip' ? null : r);
        setCobroVisible(true);
    };

    // ================== Render ==================

    if (catalogoEmpty) {
        return (
            <Screen edges={['top', 'bottom']}>
                <EmptyState
                    icon={<Ionicons name="cloud-offline-outline" size={48} color={t.color.fg.tertiary} />}
                    title="Catálogo no disponible"
                    description="Para empezar a vender necesitas descargar el catálogo de esta tienda al menos una vez con conexión."
                    actionLabel={catalogoSyncing ? 'SINCRONIZANDO…' : 'SINCRONIZAR CATÁLOGO'}
                    onAction={() => void trySyncCatalogo({ forceFull: true })}
                />
                {catalogoError ? (
                    <Text variant="bodySm" tone="danger" align="center" style={{ paddingHorizontal: t.space['6'] }}>
                        {catalogoError}
                    </Text>
                ) : null}
            </Screen>
        );
    }

    // Desglose de IVA del total del carrito. `subtotal` ya viene con IVA
    // (precio de venta final). Calculamos neto + IVA para mostrarlo.
    const ivaPct = negocio?.impuestoVentaPorcentaje ?? 19;
    const totalConIva = carrito.subtotal;
    const totalNeto = totalConIva > 0 ? Math.round(totalConIva / (1 + ivaPct / 100)) : 0;
    const ivaMonto = totalConIva - totalNeto;

    const footer = (
        <View style={{ gap: t.space['2'] }}>
            {!carrito.vacio ? (
                <View style={{ gap: 2 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text variant="bodySm" tone="secondary">Neto</Text>
                        <Text variant="monoSm" tone="secondary" tabular>
                            {formatCLP(totalNeto)}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text variant="bodySm" tone="secondary">{`IVA (${ivaPct}%)`}</Text>
                        <Text variant="monoSm" tone="secondary" tabular>
                            {formatCLP(ivaMonto)}
                        </Text>
                    </View>
                </View>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space['3'] }}>
                <View style={{ flex: 1 }}>
                    <Text variant="label" tone="tertiary">
                        Total · {carrito.cantidadItems}{' '}
                        {carrito.cantidadItems === 1 ? 'item' : 'items'}
                    </Text>
                    <Text variant="displayMd" tabular style={{ fontFamily: t.font.mono }}>
                        {formatCLP(totalConIva)}
                    </Text>
                </View>
                {!carrito.vacio ? (
                    <Button variant="ghost" size="md" label="Vaciar" onPress={vaciar} />
                ) : null}
                <Button
                    variant="primary"
                    size="lg"
                    label="COBRAR"
                    disabled={carrito.vacio || !puedeVender}
                    onPress={() => {
                        setError(null);
                        setUltimoTicket(null);
                        setClienteResuelto(null);
                        setClienteModalVisible(true);
                    }}
                />
            </View>
        </View>
    );

    return (
        <Screen edges={['top']} paddingH={0} footer={footer} keyboardAvoiding>
            {/* Warning sync antiguo */}
            {diasSinSync !== null && diasSinSync > 7 ? (
                <View
                    style={{
                        backgroundColor: t.color.feedback.warningBg,
                        paddingHorizontal: t.space['4'],
                        paddingVertical: t.space['2'],
                    }}
                >
                    <Text variant="bodySm" tone="warning" align="center">
                        Catálogo sin actualizar hace {diasSinSync} días — conectate para sincronizar
                    </Text>
                </View>
            ) : null}

            {/* Header */}
            <View style={{ paddingHorizontal: t.space['4'], paddingTop: t.space['3'], paddingBottom: t.space['3'] }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space['2'] }}>
                    <Text variant="displayLg" style={{ flex: 1 }}>POS</Text>
                    {!online ? <Badge tone="warning" variant="soft" label="OFFLINE" /> : null}
                </View>
                <Text variant="bodyMd" tone="secondary" style={{ marginTop: 2 }} numberOfLines={1}>
                    {negocio?.nombre}
                    {ubicacionActual ? ` · ${ubicacionActual}` : ''}
                </Text>
            </View>

            {/* Chips de ubicaciones */}
            {!esVendedor && ubicaciones.length > 1 ? (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{
                        paddingHorizontal: t.space['4'],
                        gap: t.space['2'],
                        paddingBottom: t.space['2'],
                    }}
                >
                    {ubicaciones.map((u) => (
                        <Chip
                            key={u.id}
                            label={`${u.nombre} · ${u.tipo === 'SUCURSAL' ? 'Sucursal' : 'Bodega'}`}
                            selected={u.id === ubicacionManualId}
                            onPress={() => setUbicacionManualId(u.id)}
                        />
                    ))}
                </ScrollView>
            ) : null}

            {/* Warning sin ubicación */}
            {!puedeVender && !cargandoUbicaciones ? (
                <View style={{ paddingHorizontal: t.space['4'], marginBottom: t.space['2'] }}>
                    <Card variant="subtle" padding={3}>
                        <Text variant="bodySm" tone="secondary">
                            {esVendedor
                                ? 'No tienes una ubicación asignada. Pide a un administrador que te asigne una sucursal para poder vender.'
                                : 'Esta tienda todavía no tiene ubicaciones. Crea una sucursal o bodega desde el panel de administración.'}
                        </Text>
                    </Card>
                </View>
            ) : null}

            {/* Barra de búsqueda + escanear */}
            <View
                style={{
                    flexDirection: 'row',
                    gap: t.space['2'],
                    paddingHorizontal: t.space['4'],
                    alignItems: 'flex-end',
                }}
            >
                <View style={{ flex: 1 }}>
                    <TextField
                        placeholder="Buscar por nombre, SKU o código…"
                        value={query}
                        onChangeText={onQueryChange}
                        autoCorrect={false}
                        editable={puedeVender}
                        leadingIcon={<Ionicons name="search" size={18} color={t.color.fg.tertiary} />}
                    />
                </View>
                <IconButton
                    variant="solid"
                    size="lg"
                    accessibilityLabel="Escanear código de barras"
                    icon={<Ionicons name="barcode-outline" size={22} color={t.color.fg.onAccent} />}
                    disabled={!puedeVender}
                    onPress={() => setScannerVisible(true)}
                />
            </View>

            {/* Tabs carrito/catalogo */}
            <View
                style={{
                    flexDirection: 'row',
                    paddingHorizontal: t.space['4'],
                    marginTop: t.space['3'],
                    marginBottom: t.space['2'],
                    gap: t.space['2'],
                    alignItems: 'center',
                }}
            >
                <Chip
                    label={`Carrito · ${carrito.cantidadItems}`}
                    selected={vista === 'carrito'}
                    onPress={() => setVista('carrito')}
                />
                <Chip
                    label="Catálogo"
                    selected={vista === 'catalogo'}
                    onPress={() => setVista('catalogo')}
                    disabled={!puedeVender}
                />
                {buscando ? (
                    <ActivityIndicator
                        color={t.color.accent.default}
                        style={{ marginLeft: t.space['1'] }}
                    />
                ) : null}
            </View>

            {/* Error inline */}
            {error ? (
                <View style={{ paddingHorizontal: t.space['4'], marginBottom: t.space['2'] }}>
                    <Text variant="bodySm" tone="danger">{error}</Text>
                </View>
            ) : null}

            {/* Ticket reciente */}
            {ultimoTicket && vista === 'carrito' ? (
                <View style={{ paddingHorizontal: t.space['4'], marginBottom: t.space['2'] }}>
                    <Card
                        variant="outline"
                        padding={3}
                        style={{
                            borderColor: ultimoTicket.pendiente
                                ? t.color.feedback.warningFg
                                : t.color.feedback.successFg,
                            borderWidth: 2,
                        }}
                    >
                        {ultimoTicket.pendiente ? (
                            <Badge
                                tone="warning"
                                variant="soft"
                                label="Copia temporal · se confirma al volver online"
                                style={{ alignSelf: 'flex-start', marginBottom: t.space['2'] }}
                            />
                        ) : (
                            <Badge
                                tone="success"
                                variant="soft"
                                label="Venta confirmada"
                                style={{ alignSelf: 'flex-start', marginBottom: t.space['2'] }}
                            />
                        )}
                        <Text variant="headingSm">
                            {ultimoTicket.pendiente
                                ? `Venta encolada (${ultimoTicket.clientVentaId.slice(0, 8)})`
                                : `Venta #${ultimoTicket.nroOrden}`}
                        </Text>
                        {ultimoTicket.vuelto !== null ? (
                            <Text variant="monoMd" tone="secondary" tabular style={{ marginTop: 2 }}>
                                Vuelto: {formatCLP(ultimoTicket.vuelto)}
                            </Text>
                        ) : null}
                        {ultimoTicket.clienteMostrado ? (
                            <Text variant="bodySm" tone="secondary" style={{ marginTop: 2 }}>
                                Cliente: {ultimoTicket.clienteMostrado}
                            </Text>
                        ) : null}
                    </Card>
                </View>
            ) : null}

            {/* Lista */}
            {vista === 'catalogo' ? (
                <FlatList
                    data={productos}
                    keyExtractor={(p) => p.producto.id}
                    style={{ flex: 1 }}
                    contentContainerStyle={
                        productos.length === 0
                            ? { flex: 1, alignItems: 'center', justifyContent: 'center' }
                            : { paddingBottom: t.space['6'] }
                    }
                    ListEmptyComponent={
                        !buscando && puedeVender ? (
                            <View style={{ paddingHorizontal: t.space['6'] }}>
                                <Text variant="bodyMd" tone="tertiary" align="center">
                                    {query.trim()
                                        ? 'Sin resultados para esa búsqueda.'
                                        : 'No hay productos en el catálogo.'}
                                </Text>
                            </View>
                        ) : null
                    }
                    renderItem={({ item }) => {
                        const disponible = item.stockAgregado;
                        const sinStock = disponible <= 0;
                        return (
                            <Pressable
                                onPress={() => abrirProducto(item)}
                                disabled={!puedeVender}
                                style={({ pressed }) => ({
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: t.space['3'],
                                    paddingHorizontal: t.space['4'],
                                    paddingVertical: t.space['3'],
                                    borderBottomWidth: t.border.default,
                                    borderBottomColor: t.color.border.subtle,
                                    backgroundColor: pressed ? t.color.bg.sunken : 'transparent',
                                    opacity: puedeVender ? 1 : 0.5,
                                })}
                            >
                                <View
                                    style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: t.radius.sm,
                                        backgroundColor: t.color.bg.sunken,
                                        borderWidth: t.border.default,
                                        borderColor: t.color.border.subtle,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Text variant="headingSm" tone="tertiary">
                                        {item.producto.nombre.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text variant="bodyMd" emphasized numberOfLines={1}>
                                        {item.producto.nombre}
                                    </Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space['2'], marginTop: 2 }}>
                                        <Text variant="monoSm" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
                                            {item.producto.sku
                                                ? `SKU ${item.producto.sku}`
                                                : item.producto.codigoBarras
                                                    ? `CB ${item.producto.codigoBarras}`
                                                    : '—'}
                                        </Text>
                                        <Text variant="bodySm" tone={sinStock ? 'danger' : 'tertiary'}>
                                            · Stock {disponible}
                                        </Text>
                                        {item.tieneVariantes ? (
                                            <Badge tone="neutral" variant="soft" label="VAR" />
                                        ) : null}
                                    </View>
                                </View>
                                <View style={{ alignItems: 'flex-end', gap: t.space['1'] }}>
                                    <Text variant="monoMd" tabular emphasized>
                                        {formatCLP(item.producto.precio)}
                                    </Text>
                                    <Button
                                        size="sm"
                                        variant={item.tieneVariantes ? 'secondary' : 'primary'}
                                        label={item.tieneVariantes ? 'Elegir' : 'Agregar'}
                                        disabled={!puedeVender}
                                        onPress={() => abrirProducto(item)}
                                    />
                                </View>
                            </Pressable>
                        );
                    }}
                />
            ) : (
                <FlatList
                    key={version}
                    data={carrito.items as any}
                    keyExtractor={(i) => i.clave}
                    style={{ flex: 1 }}
                    contentContainerStyle={
                        carrito.vacio
                            ? { flex: 1, alignItems: 'center', justifyContent: 'center' }
                            : { paddingBottom: t.space['6'] }
                    }
                    ListEmptyComponent={
                        <View style={{ paddingHorizontal: t.space['6'] }}>
                            <EmptyState
                                icon={<Ionicons name="cart-outline" size={40} color={t.color.fg.tertiary} />}
                                title="Carrito vacío"
                                description="Escanea un código, busca un producto o abre el catálogo para empezar a vender."
                                actionLabel="Ver catálogo"
                                onAction={() => setVista('catalogo')}
                            />
                        </View>
                    }
                    renderItem={({ item }) => {
                        const varianteId = item.variante?.id ?? null;
                        const disponible = varianteId
                            ? stockDeVariante(varianteId)
                            : stockDeProducto(item.producto.id);
                        return (
                            <View
                                style={{
                                    paddingHorizontal: t.space['4'],
                                    paddingVertical: t.space['3'],
                                    borderBottomWidth: t.border.default,
                                    borderBottomColor: t.color.border.subtle,
                                    gap: t.space['2'],
                                }}
                            >
                                {/* Fila superior: imagen + nombre/variante + total línea + eliminar */}
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: t.space['3'],
                                    }}
                                >
                                    {item.producto.imagenUrl ? (
                                        <Image
                                            source={{ uri: item.producto.imagenUrl }}
                                            style={{ width: 48, height: 48, borderRadius: t.radius.md }}
                                            contentFit="cover"
                                        />
                                    ) : (
                                        <View
                                            style={{
                                                width: 48,
                                                height: 48,
                                                borderRadius: t.radius.md,
                                                backgroundColor: t.color.bg.sunken,
                                                borderWidth: t.border.default,
                                                borderColor: t.color.border.subtle,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <Text variant="bodyMd" tone="tertiary" emphasized>
                                                {item.producto.nombre.charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                    )}
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <Text variant="bodyMd" emphasized numberOfLines={2}>
                                            {item.producto.nombre}
                                        </Text>
                                        {item.varianteLabel ? (
                                            <Text
                                                variant="bodySm"
                                                tone="accent"
                                                numberOfLines={1}
                                                style={{ marginTop: 2 }}
                                            >
                                                {item.varianteLabel}
                                            </Text>
                                        ) : null}
                                        <Text
                                            variant="monoSm"
                                            tone="tertiary"
                                            tabular
                                            numberOfLines={1}
                                            style={{ marginTop: 2 }}
                                        >
                                            {formatCLP(item.precioUnitario)} c/u · Stock {disponible}
                                        </Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text variant="monoMd" tabular emphasized>
                                            {formatCLP(item.subtotal)}
                                        </Text>
                                        <IconButton
                                            size="sm"
                                            variant="ghost"
                                            accessibilityLabel="Quitar del carrito"
                                            icon={
                                                <Ionicons
                                                    name="trash-outline"
                                                    size={16}
                                                    color={t.color.feedback.dangerFg}
                                                />
                                            }
                                            onPress={() => quitar(item.producto.id, varianteId)}
                                        />
                                    </View>
                                </View>

                                {/* Fila inferior: controles de cantidad alineados a la derecha. */}
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'flex-end',
                                        gap: t.space['2'],
                                    }}
                                >
                                    <IconButton
                                        size="md"
                                        variant="outline"
                                        accessibilityLabel="Quitar uno"
                                        icon={<Ionicons name="remove" size={18} color={t.color.fg.primary} />}
                                        onPress={() => handleDecrementar(item.producto.id, varianteId)}
                                    />
                                    <Text
                                        variant="monoMd"
                                        tabular
                                        emphasized
                                        style={{ minWidth: 32, textAlign: 'center' }}
                                    >
                                        {item.cantidad}
                                    </Text>
                                    <IconButton
                                        size="md"
                                        variant="outline"
                                        accessibilityLabel="Agregar uno"
                                        icon={<Ionicons name="add" size={18} color={t.color.fg.primary} />}
                                        onPress={() => handleIncrementar(item.producto.id, varianteId)}
                                    />
                                </View>
                            </View>
                        );
                    }}
                />
            )}

            <ScannerModal
                visible={scannerVisible}
                onClose={() => setScannerVisible(false)}
                onScan={handleScan}
            />
            {sesion && negocio ? (
                <ClienteModal
                    visible={clienteModalVisible}
                    negocioId={negocio.id}
                    token={sesion.token}
                    onClose={() => setClienteModalVisible(false)}
                    onResuelto={handleClienteResuelto}
                />
            ) : null}
            <CobroModal
                visible={cobroVisible}
                carrito={carrito}
                onClose={() => setCobroVisible(false)}
                onConfirmar={cobrar}
            />
            {sesion && negocio ? (
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
            ) : null}
        </Screen>
    );
}
