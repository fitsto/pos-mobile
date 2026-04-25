/**
 * POS — pantalla de venta presencial (versión simplificada).
 *
 * Estructura:
 *   - Header: nombre del negocio + ubicación actual.
 *   - Chips de ubicación (admin/cajero con varias).
 *   - Cuerpo:
 *       · Carrito vacío  → dos CTAs grandes: "Escanear" + "Ver catálogo".
 *       · Carrito lleno → lista de items + botoncitos "Escanear" / "Catálogo".
 *   - Footer sticky: total + COBRAR.
 *
 * Búsqueda libre y vista catálogo se movieron a `app/catalogo-venta.tsx`.
 * El POS se enfoca en lo que el cajero hace 90% del tiempo: escanear y cobrar.
 *
 * Escaneo:
 *   - Toggle Uno/Varios visible en el modal. Default 'Uno' (mantiene hábito).
 *   - En 'Varios' la cámara queda abierta y cada lectura agrega al carrito
 *     con feedback (haptic + beep + flash). El cajero pulsa "Listo" al final.
 */
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    ScrollView,
    View,
} from 'react-native';
import type { CatalogoProducto } from '../../src/contexts/catalogo-local/domain/CatalogoSnapshot';
import { Producto } from '../../src/contexts/producto/domain/Producto';
import type { Modelo, Variante } from '../../src/contexts/producto/domain/Variante';
import { DomainError } from '../../src/contexts/shared/domain/DomainError';
import type { Ubicacion } from '../../src/contexts/ubicacion/domain/Ubicacion';
import type { VarianteInfo } from '../../src/contexts/venta/domain/ItemCarrito';
import type { MedioPago } from '../../src/contexts/venta/domain/MedioPago';
import { trySyncCatalogo } from '../../src/runtime/catalogo/CatalogoSyncManager';
import { toProducto } from '../../src/runtime/catalogo/toProducto';
import { ClienteModal, type ClienteResuelto } from '../../src/runtime/components/ClienteModal';
import { CobroModal } from '../../src/runtime/components/CobroModal';
import { ScannerModal, type ScannerMode } from '../../src/runtime/components/ScannerModal';
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
    const router = useRouter();
    const sesion = useSesionStore((s) => s.sesion);
    const negocio = useSesionStore((s) => s.negocio);
    const { carrito, version, agregar, quitar, setCantidad, vaciar } = useCarritoStore();

    const catalogoEmpty = useCatalogoSyncStore((s) => s.empty);
    const catalogoSyncing = useCatalogoSyncStore((s) => s.syncing);
    const lastSyncAt = useCatalogoSyncStore((s) => s.lastSyncAt);
    const catalogoError = useCatalogoSyncStore((s) => s.error);
    const diasSinSync = diasDesdeUltimaSync(lastSyncAt);
    const online = useOfflineQueueStore((s) => s.online) !== false;

    const [scannerVisible, setScannerVisible] = useState(false);
    const [scannerMode, setScannerMode] = useState<ScannerMode>('single');
    const [scanFlash, setScanFlash] = useState<string | null>(null);
    const [scanFlashKey, setScanFlashKey] = useState(0);
    const [cobroVisible, setCobroVisible] = useState(false);
    const [clienteModalVisible, setClienteModalVisible] = useState(false);
    const [clienteResuelto, setClienteResuelto] = useState<ClienteResuelto | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [ultimoTicket, setUltimoTicket] = useState<TicketInfo | null>(null);
    const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
    const [ubicacionManualId, setUbicacionManualId] = useState<string | null>(null);
    const [cargandoUbicaciones, setCargandoUbicaciones] = useState(false);
    const [selectorProducto, setSelectorProducto] = useState<Producto | null>(null);
    const [stockPorVariante, setStockPorVariante] = useState<Map<string, number>>(new Map());
    const [scanBusy, setScanBusy] = useState(false);


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

    useEffect(() => {
        if (online) void trySyncCatalogo();
    }, [online]);

    // Stock por variante (sólo lo necesita el SelectorVarianteModal). Se refresca
    // cuando el carrito cambia para mantener el selector consistente.
    useEffect(() => {
        if (!ubicacionId || carrito.items.length === 0) {
            setStockPorVariante(new Map());
            return;
        }
        let cancelado = false;
        (async () => {
            const varMap = new Map<string, number>();
            for (const it of carrito.items) {
                if (it.variante) {
                    const stk = await container.catalogoLocalRepo.findStockLocal(
                        it.producto.id,
                        it.variante.id,
                        ubicacionId,
                    );
                    varMap.set(it.variante.id, stk);
                }
            }
            if (!cancelado) setStockPorVariante(varMap);
        })();
        return () => {
            cancelado = true;
        };
    }, [ubicacionId, version, carrito]);

    const cantidadEnCarritoMap = useMemo(() => {
        const map = new Map<string, number>();
        for (const it of carrito.items) map.set(it.clave, it.cantidad);
        return map;
    }, [carrito, version]);

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
    };

    const triggerFlash = (texto: string) => {
        // Pasamos el texto limpio + un counter separado: el modal usa el
        // counter como trigger para reanimar incluso si el texto se repite.
        setScanFlash(texto);
        setScanFlashKey((k) => k + 1);
    };

    const handleScan = async (codigo: string) => {
        if (!ubicacionId || scanBusy) return;
        setScanBusy(true);
        setError(null);
        try {
            const items = await container.catalogoLocalRepo.buscarProductos({
                q: codigo,
                ubicacionId,
                limit: 10,
            });
            const exacto = items.find((i) => i.producto.codigoBarra === codigo) ?? items[0];
            if (!exacto) {
                if (scannerMode === 'multi') {
                    triggerFlash(`Sin coincidencia: ${codigo}`);
                } else {
                    setError(`No se encontró producto con código ${codigo}`);
                    setScannerVisible(false);
                }
                return;
            }
            const vista: ProductoVista = {
                producto: toProducto(exacto.producto),
                raw: exacto.producto,
                stockAgregado: exacto.stockAgregado,
                tieneVariantes: exacto.tieneVariantes,
            };
            if (vista.tieneVariantes) {
                // Productos con variantes nunca se agregan en modo ráfaga: no
                // sabríamos qué talla. Cerramos el modal y dejamos al cajero
                // elegir variante en el selector.
                setScannerVisible(false);
                setSelectorProducto(vista.producto);
                return;
            }
            handleAgregar(vista.producto, null);
            const yaEnCarrito =
                (cantidadEnCarritoMap.get(`${vista.producto.id}::`) ?? 0) + 1;
            triggerFlash(`✓ ${vista.producto.nombre} (x${yaEnCarrito})`);
            if (scannerMode === 'single') {
                setScannerVisible(false);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al buscar');
            if (scannerMode === 'single') setScannerVisible(false);
        } finally {
            setScanBusy(false);
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
        } catch (e) {
            throw e instanceof DomainError || e instanceof Error ? e : new Error('Error desconocido');
        }
    };

    const handleClienteResuelto = (r: ClienteResuelto) => {
        setClienteModalVisible(false);
        setClienteResuelto(r.tipo === 'skip' ? null : r);
        setCobroVisible(true);
    };

    const claveDe = (productoId: string, varianteId: string | null): string =>
        varianteId ? `${productoId}:${varianteId}` : `${productoId}::`;

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

    const irAlCatalogo = () => {
        if (!ubicacionId) return;
        router.push({
            pathname: '/catalogo-venta',
            params: { ubicacionId },
        });
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

            {/* Action bar superior cuando el carrito tiene items */}
            {!carrito.vacio ? (
                <View
                    style={{
                        flexDirection: 'row',
                        gap: t.space['2'],
                        paddingHorizontal: t.space['4'],
                        paddingBottom: t.space['2'],
                    }}
                >
                    <Button
                        variant="secondary"
                        size="md"
                        label="Escanear"
                        leadingIcon={<Ionicons name="barcode-outline" size={18} color={t.color.fg.primary} />}
                        onPress={() => {
                            setScannerVisible(true);
                        }}
                        disabled={!puedeVender}
                        style={{ flex: 1 }}
                    />
                    <Button
                        variant="secondary"
                        size="md"
                        label="Catálogo"
                        leadingIcon={<Ionicons name="cube-outline" size={18} color={t.color.fg.primary} />}
                        onPress={irAlCatalogo}
                        disabled={!puedeVender}
                        style={{ flex: 1 }}
                    />
                </View>
            ) : null}

            {/* Error inline */}
            {error ? (
                <View style={{ paddingHorizontal: t.space['4'], marginBottom: t.space['2'] }}>
                    <Text variant="bodySm" tone="danger">{error}</Text>
                </View>
            ) : null}

            {/* Ticket reciente */}
            {ultimoTicket ? (
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

            {/* Cuerpo: carrito o CTAs grandes */}
            {carrito.vacio ? (
                <View
                    style={{
                        flex: 1,
                        paddingHorizontal: t.space['4'],
                        gap: t.space['3'],
                        justifyContent: 'center',
                    }}
                >
                    <CTAGrande
                        icono="barcode-outline"
                        titulo="Escanear código"
                        descripcion="Una lectura o varias seguidas. Cada código se agrega al carrito."
                        destacada
                        disabled={!puedeVender}
                        onPress={() => setScannerVisible(true)}
                    />
                    <CTAGrande
                        icono="cube-outline"
                        titulo="Ver catálogo"
                        descripcion="Lista de productos con stock. Filtra por categoría, marca o texto."
                        disabled={!puedeVender}
                        onPress={irAlCatalogo}
                    />
                </View>
            ) : (
                <FlatList
                    key={version}
                    data={carrito.items as any}
                    keyExtractor={(i) => i.clave}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: t.space['6'] }}
                    renderItem={({ item }) => {
                        const varianteId = item.variante?.id ?? null;
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
                                            {formatCLP(item.precioUnitario)} c/u
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

            {scanBusy ? (
                <View style={{ position: 'absolute', top: 80, alignSelf: 'center' }}>
                    <ActivityIndicator color={t.color.accent.default} />
                </View>
            ) : null}

            <ScannerModal
                visible={scannerVisible}
                onClose={() => setScannerVisible(false)}
                onScan={handleScan}
                mode={scannerMode}
                onModeChange={setScannerMode}
                lastScanFlash={scanFlash}
                flashKey={scanFlashKey}
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
                    onClose={() => setSelectorProducto(null)}
                    onSeleccionar={(p, variante) => {
                        setSelectorProducto(null);
                        handleAgregar(p, variante);
                    }}
                />
            ) : null}
        </Screen>
    );
}

function CTAGrande({
    icono,
    titulo,
    descripcion,
    destacada,
    disabled,
    onPress,
}: {
    icono: keyof typeof Ionicons.glyphMap;
    titulo: string;
    descripcion: string;
    destacada?: boolean;
    disabled?: boolean;
    onPress: () => void;
}) {
    const t = useTheme();
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={({ pressed }) => ({
                borderRadius: t.radius.lg,
                borderWidth: t.border.default,
                borderColor: destacada ? t.color.accent.default : t.color.border.subtle,
                backgroundColor: destacada
                    ? pressed
                        ? t.color.accent.pressed
                        : t.color.accent.default
                    : pressed
                        ? t.color.bg.sunken
                        : t.color.bg.raised,
                padding: t.space['4'],
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.space['3'],
                opacity: disabled ? 0.5 : 1,
            })}
        >
            <View
                style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: destacada
                        ? 'rgba(255,255,255,0.18)'
                        : t.color.bg.sunken,
                }}
            >
                <Ionicons
                    name={icono}
                    size={28}
                    color={destacada ? t.color.fg.onAccent : t.color.fg.primary}
                />
            </View>
            <View style={{ flex: 1 }}>
                <Text
                    variant="headingSm"
                    style={destacada ? { color: t.color.fg.onAccent } : undefined}
                >
                    {titulo}
                </Text>
                <Text
                    variant="bodySm"
                    style={{
                        marginTop: 2,
                        color: destacada ? t.color.fg.onAccent : t.color.fg.secondary,
                        opacity: destacada ? 0.9 : 1,
                    }}
                >
                    {descripcion}
                </Text>
            </View>
            <Ionicons
                name="chevron-forward"
                size={20}
                color={destacada ? t.color.fg.onAccent : t.color.fg.tertiary}
            />
        </Pressable>
    );
}
