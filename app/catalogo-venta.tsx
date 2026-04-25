/**
 * Catálogo del POS — pantalla dedicada para que el cajero busque productos
 * con filtros antes de cobrar. Convive con el POS (que queda enfocado en el
 * carrito) y se invoca desde ahí con `router.push('/catalogo-venta?ubicacionId=...')`.
 *
 * Filtros disponibles:
 *   - Búsqueda libre (nombre / SKU / código de barras / SKU de variante).
 *   - Categorías (chips multi-select OR).
 *   - Marcas     (chips multi-select OR).
 *   - "Solo con stock" (default ON, lo que el cajero realmente puede vender).
 *
 * Al tocar un producto:
 *   - Sin variantes → se agrega 1 al carrito y aparece un flash efímero
 *     "✓ {nombre} agregado".
 *   - Con variantes → abre `SelectorVarianteModal`.
 *
 * Footer sticky: "Volver al POS · N items" para que el cajero vea cuánto
 * lleva agregado y vuelva sin perder contexto.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, View } from 'react-native';
import type { CatalogoProducto } from '../src/contexts/catalogo-local/domain/CatalogoSnapshot';
import { Producto } from '../src/contexts/producto/domain/Producto';
import type { Modelo, Variante } from '../src/contexts/producto/domain/Variante';
import type { VarianteInfo } from '../src/contexts/venta/domain/ItemCarrito';
import { toProducto } from '../src/runtime/catalogo/toProducto';
import { SelectorVarianteModal } from '../src/runtime/components/SelectorVarianteModal';
import {
    Badge,
    Button,
    Chip,
    EmptyState,
    Screen,
    Text,
    TextField,
} from '../src/runtime/components/ui';
import { container } from '../src/runtime/di/container';
import { useCarritoStore } from '../src/runtime/stores/CarritoStore';
import { useSesionStore } from '../src/runtime/stores/SesionStore';
import { useTheme } from '../src/runtime/theme/ThemeProvider';
import { formatCLP } from '../src/runtime/utils/formato';

interface ProductoVista {
    producto: Producto;
    raw: CatalogoProducto;
    stockAgregado: number;
    tieneVariantes: boolean;
}

const FLASH_MS = 1400;

export default function CatalogoVentaScreen() {
    const t = useTheme();
    const router = useRouter();
    const { ubicacionId: ubicacionIdParam } = useLocalSearchParams<{ ubicacionId?: string }>();
    const sesion = useSesionStore((s) => s.sesion);
    const negocio = useSesionStore((s) => s.negocio);
    const { carrito, version, agregar } = useCarritoStore();

    const [query, setQuery] = useState('');
    const [productos, setProductos] = useState<ProductoVista[]>([]);
    const [buscando, setBuscando] = useState(false);
    const [categorias, setCategorias] = useState<{ id: string; nombre: string }[]>([]);
    const [marcas, setMarcas] = useState<{ id: string; nombre: string }[]>([]);
    const [categoriasSel, setCategoriasSel] = useState<Set<string>>(new Set());
    const [marcasSel, setMarcasSel] = useState<Set<string>>(new Set());
    const [soloConStock, setSoloConStock] = useState(true);
    const [selectorProducto, setSelectorProducto] = useState<Producto | null>(null);
    const [stockPorVariante, setStockPorVariante] = useState<Map<string, number>>(new Map());
    const [flash, setFlash] = useState<string | null>(null);

    const ubicacionId = ubicacionIdParam ?? null;

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        let cancelado = false;
        Promise.all([
            container.catalogoLocalRepo.listarCategoriasUsadas(),
            container.catalogoLocalRepo.listarMarcasUsadas(),
        ])
            .then(([cs, ms]) => {
                if (cancelado) return;
                setCategorias(cs);
                setMarcas(ms);
            })
            .catch(() => {
                // No es fatal: sin categorías/marcas la búsqueda libre sigue funcionando.
            });
        return () => {
            cancelado = true;
        };
    }, []);

    const fetchProductos = useCallback(
        async (texto: string, catSel: Set<string>, marcaSel: Set<string>, conStock: boolean) => {
            if (!ubicacionId) return;
            setBuscando(true);
            try {
                const items = await container.catalogoLocalRepo.buscarProductos({
                    q: texto,
                    ubicacionId,
                    limit: 100,
                    categoriaIds: catSel.size > 0 ? Array.from(catSel) : undefined,
                    marcaIds: marcaSel.size > 0 ? Array.from(marcaSel) : undefined,
                    soloConStock: conStock,
                });
                const vistas: ProductoVista[] = items.map((i) => ({
                    producto: toProducto(i.producto),
                    raw: i.producto,
                    stockAgregado: i.stockAgregado,
                    tieneVariantes: i.tieneVariantes,
                }));
                setProductos(vistas);

                // Pre-cacheamos stock por variante de los productos con variantes
                // para que el selector ya tenga los números al abrirse.
                const varMap = new Map<string, number>();
                for (const v of vistas) {
                    if (!v.tieneVariantes) continue;
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
                setStockPorVariante(varMap);
            } catch {
                // Errores silenciosos: el sqlite local rara vez falla; si lo
                // hace, simplemente no mostramos resultados.
            } finally {
                setBuscando(false);
            }
        },
        [ubicacionId],
    );

    // Re-fetch ante cambio de filtros (texto con debounce, chips inmediato).
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            void fetchProductos(query, categoriasSel, marcasSel, soloConStock);
        }, 200);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query, categoriasSel, marcasSel, soloConStock, fetchProductos]);

    const toggleSet = (set: Set<string>, id: string): Set<string> => {
        const next = new Set(set);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    };

    const triggerFlash = (texto: string) => {
        setFlash(texto);
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => setFlash(null), FLASH_MS);
    };

    const handleAgregar = (p: Producto, variante: VarianteInfo | null) => {
        agregar(p, 1, variante);
        const sufijo = variante ? ` · ${variante.modeloNombre ?? ''}${variante.talla ? ` ${variante.talla}` : ''}` : '';
        triggerFlash(`✓ ${p.nombre}${sufijo}`);
    };

    const abrirProducto = (v: ProductoVista) => {
        if (v.tieneVariantes) {
            setSelectorProducto(v.producto);
            return;
        }
        handleAgregar(v.producto, null);
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

    const filtrosActivos =
        categoriasSel.size + marcasSel.size + (soloConStock ? 0 : 0) + (query.trim() ? 1 : 0) > 0;

    const limpiarFiltros = () => {
        setQuery('');
        setCategoriasSel(new Set());
        setMarcasSel(new Set());
    };

    const itemsCarrito = useMemo(() => carrito.cantidadItems, [carrito, version]);

    const footer = (
        <Button
            variant="primary"
            size="lg"
            label={`Volver al POS${itemsCarrito > 0 ? ` · ${itemsCarrito} ${itemsCarrito === 1 ? 'item' : 'items'}` : ''}`}
            onPress={() => router.back()}
            fullWidth
            leadingIcon={<Ionicons name="arrow-back" size={18} color={t.color.fg.onAccent} />}
        />
    );

    return (
        <Screen
            title="Catálogo"
            subtitle={negocio?.nombre ?? undefined}
            onBack={() => router.back()}
            paddingH={0}
            footer={footer}
            keyboardAvoiding
        >
            {/* Búsqueda */}
            <View style={{ paddingHorizontal: t.space['4'], paddingTop: t.space['2'] }}>
                <TextField
                    placeholder="Buscar nombre, SKU, código…"
                    value={query}
                    onChangeText={setQuery}
                    autoCorrect={false}
                    leadingIcon={<Ionicons name="search" size={18} color={t.color.fg.tertiary} />}
                />
            </View>

            {/* Filtro categorías */}
            {categorias.length > 0 ? (
                <FiltroChips
                    label="Categoría"
                    items={categorias}
                    seleccionados={categoriasSel}
                    onToggle={(id) => setCategoriasSel((s) => toggleSet(s, id))}
                />
            ) : null}

            {/* Filtro marcas */}
            {marcas.length > 0 ? (
                <FiltroChips
                    label="Marca"
                    items={marcas}
                    seleccionados={marcasSel}
                    onToggle={(id) => setMarcasSel((s) => toggleSet(s, id))}
                />
            ) : null}

            {/* Toggle stock + clear */}
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: t.space['4'],
                    marginTop: t.space['2'],
                    marginBottom: t.space['2'],
                    gap: t.space['2'],
                }}
            >
                <Chip
                    label={soloConStock ? 'Solo con stock' : 'Mostrar todos'}
                    selected={soloConStock}
                    onPress={() => setSoloConStock((v) => !v)}
                />
                {filtrosActivos ? (
                    <Pressable onPress={limpiarFiltros} hitSlop={8}>
                        <Text variant="bodySm" tone="accent" emphasized>
                            Limpiar
                        </Text>
                    </Pressable>
                ) : null}
                {buscando ? (
                    <ActivityIndicator color={t.color.accent.default} style={{ marginLeft: 'auto' }} />
                ) : null}
            </View>

            {/* Lista */}
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
                    !buscando ? (
                        <View style={{ paddingHorizontal: t.space['6'] }}>
                            <EmptyState
                                icon={<Ionicons name="cube-outline" size={40} color={t.color.fg.tertiary} />}
                                title={filtrosActivos ? 'Sin resultados' : 'Catálogo vacío'}
                                description={
                                    filtrosActivos
                                        ? 'Probá quitar algún filtro o cambiar el texto.'
                                        : 'Sincronizá el catálogo desde el POS.'
                                }
                            />
                        </View>
                    ) : null
                }
                renderItem={({ item }) => {
                    const sinStock = item.stockAgregado <= 0;
                    return (
                        <Pressable
                            onPress={() => abrirProducto(item)}
                            style={({ pressed }) => ({
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: t.space['3'],
                                paddingHorizontal: t.space['4'],
                                paddingVertical: t.space['3'],
                                borderBottomWidth: t.border.default,
                                borderBottomColor: t.color.border.subtle,
                                backgroundColor: pressed ? t.color.bg.sunken : 'transparent',
                            })}
                        >
                            {item.producto.imagenUrl ? (
                                <Image
                                    source={{ uri: item.producto.imagenUrl }}
                                    style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: t.radius.sm,
                                    }}
                                    contentFit="cover"
                                />
                            ) : (
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
                            )}
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text variant="bodyMd" emphasized numberOfLines={1}>
                                    {item.producto.nombre}
                                </Text>
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: t.space['2'],
                                        marginTop: 2,
                                    }}
                                >
                                    <Text
                                        variant="monoSm"
                                        tone="tertiary"
                                        numberOfLines={1}
                                        style={{ flexShrink: 1 }}
                                    >
                                        {item.producto.sku
                                            ? `SKU ${item.producto.sku}`
                                            : item.producto.codigoBarras
                                                ? `CB ${item.producto.codigoBarras}`
                                                : '—'}
                                    </Text>
                                    <Text variant="bodySm" tone={sinStock ? 'danger' : 'tertiary'}>
                                        · Stock {item.stockAgregado}
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
                                    onPress={() => abrirProducto(item)}
                                />
                            </View>
                        </Pressable>
                    );
                }}
            />

            {/* Flash de confirmación */}
            {flash ? (
                <View
                    pointerEvents="none"
                    style={{
                        position: 'absolute',
                        bottom: 96,
                        alignSelf: 'center',
                        backgroundColor: t.color.accent.default,
                        paddingHorizontal: t.space['4'],
                        paddingVertical: t.space['3'],
                        borderRadius: t.radius.md,
                        maxWidth: '85%',
                    }}
                >
                    <Text variant="bodyMd" emphasized style={{ color: '#fff', textAlign: 'center' }}>
                        {flash}
                    </Text>
                </View>
            ) : null}

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

function FiltroChips({
    label,
    items,
    seleccionados,
    onToggle,
}: {
    label: string;
    items: { id: string; nombre: string }[];
    seleccionados: Set<string>;
    onToggle: (id: string) => void;
}) {
    const t = useTheme();
    return (
        <View style={{ marginTop: t.space['2'] }}>
            <Text
                variant="label"
                tone="tertiary"
                style={{ paddingHorizontal: t.space['4'], marginBottom: t.space['1'] }}
            >
                {label}
            </Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                    paddingHorizontal: t.space['4'],
                    gap: t.space['2'],
                }}
            >
                {items.map((it) => (
                    <Chip
                        key={it.id}
                        label={it.nombre}
                        selected={seleccionados.has(it.id)}
                        onPress={() => onToggle(it.id)}
                    />
                ))}
            </ScrollView>
        </View>
    );
}
