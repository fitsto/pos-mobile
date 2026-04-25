/**
 * Productos — listado del catálogo.
 *
 * Entrada principal al módulo: búsqueda + escáner, tap para ir al detalle,
 * FAB para crear un producto nuevo y un acceso secundario a "Ajuste rápido"
 * (la pantalla vieja que movimos a `/producto/ajustar`).
 *
 * El detalle del producto y el wizard viven fuera del stack de tabs para que
 * el navigate stack pueda hacer back con chevron propio sin chocar con la
 * bottom bar.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    View,
} from 'react-native';
import type { Producto } from '../../src/contexts/producto/domain/Producto';
import { OfflineBanner } from '../../src/runtime/components/OfflineBanner';
import { ScannerModal } from '../../src/runtime/components/ScannerModal';
import {
    Button,
    EmptyState,
    IconButton,
    ListItem,
    Screen,
    Text,
    TextField,
} from '../../src/runtime/components/ui';
import { container } from '../../src/runtime/di/container';
import { useSesionStore } from '../../src/runtime/stores/SesionStore';
import { useTheme } from '../../src/runtime/theme/ThemeProvider';
import { formatCLP } from '../../src/runtime/utils/formato';

export default function ProductosScreen() {
    const t = useTheme();
    const router = useRouter();
    const sesion = useSesionStore((s) => s.sesion);
    const negocio = useSesionStore((s) => s.negocio);
    const puedeGestionar = negocio?.puedeGestionarStock ?? false;

    const [query, setQuery] = useState('');
    const [productos, setProductos] = useState<Producto[]>([]);
    const [cargando, setCargando] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [scannerVisible, setScannerVisible] = useState(false);
    const [incluirInactivos, setIncluirInactivos] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cargar = useCallback(
        async (texto: string) => {
            if (!sesion || !negocio) return;
            setCargando(true);
            setError(null);
            try {
                const items = await container.buscarProducto.execute({
                    negocioId: negocio.id,
                    query: texto,
                    token: sesion.token,
                    incluirInactivos,
                });
                setProductos(items);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Error al cargar productos');
            } finally {
                setCargando(false);
            }
        },
        [sesion, negocio, incluirInactivos],
    );

    // Debounce simple: 250 ms desde el último cambio.
    useEffect(() => {
        const h = setTimeout(() => {
            void cargar(query);
        }, 250);
        return () => clearTimeout(h);
    }, [query, cargar]);

    // Refrescar al volver a la pantalla (ej: después de crear/eliminar/reactivar
    // un producto desde el detalle). Sin esto, la lista queda con la copia vieja
    // hasta que el usuario haga pull-to-refresh o cambie la query.
    useFocusEffect(
        useCallback(() => {
            void cargar(query);
            // query intencionalmente excluido — el efecto de debounce ya lo cubre,
            // y acá solo queremos refrescar "al enfocar" con lo que ya está escrito.
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [cargar]),
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await cargar(query);
        } finally {
            setRefreshing(false);
        }
    }, [cargar, query]);

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
                router.push(`/producto/${exacto.id}`);
            } else {
                setError(`No se encontró producto con código ${codigo}`);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al buscar');
        }
    };

    const header = useMemo(
        () => (
            <View style={{ paddingHorizontal: t.space['4'], gap: t.space['2'] }}>
                <OfflineBanner />
                <View style={{ flexDirection: 'row', gap: t.space['2'], alignItems: 'flex-end' }}>
                    <View style={{ flex: 1 }}>
                        <TextField
                            placeholder="Buscar por nombre, SKU, código…"
                            value={query}
                            onChangeText={setQuery}
                            leadingIcon={<Ionicons name="search" size={18} color={t.color.fg.tertiary} />}
                        />
                    </View>
                    <IconButton
                        variant="solid"
                        size="lg"
                        accessibilityLabel="Escanear código de barras"
                        icon={<Ionicons name="barcode-outline" size={22} color={t.color.fg.onAccent} />}
                        onPress={() => setScannerVisible(true)}
                    />
                </View>
                {puedeGestionar ? (
                    <View style={{ flexDirection: 'row', gap: t.space['2'], marginTop: t.space['1'] }}>
                        <Button
                            variant="secondary"
                            size="md"
                            label="Ajuste rápido"
                            leadingIcon={
                                <Ionicons name="swap-vertical" size={16} color={t.color.fg.primary} />
                            }
                            onPress={() => router.push('/producto/ajustar')}
                            style={{ flex: 1 }}
                        />
                        <Button
                            variant={incluirInactivos ? 'primary' : 'secondary'}
                            size="md"
                            label={incluirInactivos ? 'Mostrando inactivos' : 'Ver inactivos'}
                            leadingIcon={
                                <Ionicons
                                    name={incluirInactivos ? 'eye' : 'eye-outline'}
                                    size={16}
                                    color={incluirInactivos ? t.color.fg.onAccent : t.color.fg.primary}
                                />
                            }
                            onPress={() => setIncluirInactivos((v) => !v)}
                            style={{ flex: 1 }}
                        />
                    </View>
                ) : null}
                <Text variant="label" tone="tertiary" style={{ marginTop: t.space['3'] }}>
                    CATÁLOGO · {productos.length}
                </Text>
            </View>
        ),
        [t, query, puedeGestionar, productos.length, router, incluirInactivos],
    );

    return (
        <Screen paddingH={0} title="Productos" subtitle={negocio?.nombre ?? undefined}>
            <FlatList
                data={productos}
                keyExtractor={(p) => p.id}
                ListHeaderComponent={header}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={t.color.accent.default}
                    />
                }
                renderItem={({ item }) => (
                    <View style={{ opacity: item.activo ? 1 : 0.5 }}>
                        <ListItem
                            leading={
                                item.imagenUrl ? (
                                    <Image
                                        source={{ uri: item.imagenUrl }}
                                        style={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: t.radius.md,
                                        }}
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
                                            {item.nombre.charAt(0).toUpperCase()}
                                        </Text>
                                    </View>
                                )
                            }
                            title={item.activo ? item.nombre : `${item.nombre} (inactivo)`}
                            subtitle={item.sku ? `SKU ${item.sku}` : item.codigoBarras ?? undefined}
                            trailing={
                                <Text variant="monoMd" tabular emphasized>
                                    {formatCLP(item.precio)}
                                </Text>
                            }
                            onPress={() => router.push(`/producto/${item.id}`)}
                            divider
                        />
                    </View>
                )}
                ListEmptyComponent={
                    cargando ? (
                        <View style={{ paddingVertical: t.space['8'] }}>
                            <ActivityIndicator color={t.color.accent.default} />
                        </View>
                    ) : (
                        <EmptyState
                            icon={
                                <Ionicons
                                    name="cube-outline"
                                    size={48}
                                    color={t.color.fg.tertiary}
                                />
                            }
                            title={query ? 'Sin resultados' : 'Aún no tienes productos'}
                            description={
                                query
                                    ? 'Prueba con otro nombre o código de barras.'
                                    : puedeGestionar
                                        ? 'Crea tu primer producto para empezar a vender.'
                                        : 'Pídele a un administrador que cree productos.'
                            }
                            actionLabel={!query && puedeGestionar ? 'Crear producto' : undefined}
                            onAction={
                                !query && puedeGestionar
                                    ? () => router.push('/producto/nuevo')
                                    : undefined
                            }
                        />
                    )
                }
                contentContainerStyle={{
                    paddingBottom: t.space['10'],
                    flexGrow: productos.length === 0 ? 1 : undefined,
                }}
            />

            {error ? (
                <View style={{ paddingHorizontal: t.space['4'], paddingBottom: t.space['2'] }}>
                    <Text variant="bodySm" tone="danger">
                        {error}
                    </Text>
                </View>
            ) : null}

            {puedeGestionar ? (
                <Pressable
                    onPress={() => router.push('/producto/nuevo')}
                    style={({ pressed }) => ({
                        position: 'absolute',
                        right: t.space['4'],
                        bottom: t.space['5'],
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: pressed ? t.color.accent.pressed : t.color.accent.default,
                        shadowColor: '#000',
                        shadowOpacity: 0.15,
                        shadowRadius: 8,
                        shadowOffset: { width: 0, height: 4 },
                        elevation: 6,
                    })}
                    accessibilityRole="button"
                    accessibilityLabel="Crear producto"
                >
                    <Ionicons name="add" size={30} color={t.color.fg.onAccent} />
                </Pressable>
            ) : null}

            <ScannerModal
                visible={scannerVisible}
                onClose={() => setScannerVisible(false)}
                onScan={onScan}
            />
        </Screen>
    );
}
