/**
 * Selector de variante para un producto (modelo + talla).
 * Agrupa por modelo, muestra thumb, precio y stock (si se pasa el mapa).
 * Usa Sheet + ListItem.
 */
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import type { Producto } from '../../contexts/producto/domain/Producto';
import type { Modelo, Variante } from '../../contexts/producto/domain/Variante';
import type { VarianteInfo } from '../../contexts/venta/domain/ItemCarrito';
import { container } from '../di/container';
import { useTheme } from '../theme/ThemeProvider';
import { formatCLP } from '../utils/formato';
import { Sheet, Text } from './ui';

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
    const t = useTheme();
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
            .finally(() => {
                if (activo) setCargando(false);
            });
        return () => {
            activo = false;
        };
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
        <Sheet
            visible={visible}
            onClose={onClose}
            title="Elige variante"
            subtitle={producto?.nombre ?? undefined}
            contentStyle={{ paddingHorizontal: 0, paddingVertical: 0 }}
        >
            {cargando ? (
                <View style={{ padding: t.space['5'], alignItems: 'center' }}>
                    <ActivityIndicator color={t.color.accent.default} />
                </View>
            ) : null}

            {error ? (
                <Text
                    variant="bodyMd"
                    style={{
                        color: t.color.feedback.dangerFg,
                        padding: t.space['5'],
                    }}
                >
                    {error}
                </Text>
            ) : null}

            {!cargando && !error && vistas.length === 0 ? (
                <Text
                    variant="bodyMd"
                    tone="tertiary"
                    style={{ padding: t.space['5'], textAlign: 'center' }}
                >
                    Este producto no tiene variantes activas.
                </Text>
            ) : null}

            <ScrollView
                style={{ maxHeight: 480 }}
                contentContainerStyle={{ paddingBottom: t.space['5'] }}
            >
                {grupos.map((g, gi) => (
                    <View key={g.modelo?.id ?? `grp-${gi}`}>
                        {g.modelo ? (
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: t.space['3'],
                                    paddingHorizontal: t.space['5'],
                                    paddingVertical: t.space['3'],
                                    backgroundColor: t.color.bg.sunken,
                                    borderTopWidth: t.border.default,
                                    borderBottomWidth: t.border.default,
                                    borderColor: t.color.border.subtle,
                                }}
                            >
                                {g.modelo.imagenUrl ? (
                                    <Image
                                        source={{ uri: g.modelo.imagenUrl }}
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: t.radius.sm,
                                            backgroundColor: t.color.bg.raised,
                                        }}
                                        contentFit="cover"
                                    />
                                ) : (
                                    <View
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: t.radius.sm,
                                            backgroundColor: t.color.bg.raised,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderWidth: t.border.default,
                                            borderColor: t.color.border.subtle,
                                        }}
                                    >
                                        <Text variant="label" tone="tertiary">
                                            {g.modelo.nombre.charAt(0).toUpperCase()}
                                        </Text>
                                    </View>
                                )}
                                <Text variant="bodyMd" style={{ fontWeight: '700' }}>
                                    {g.modelo.nombre}
                                </Text>
                            </View>
                        ) : null}
                        {g.items.map((v) => {
                            const sinStock = bloquearSinStock && v.stock !== null && v.stock <= 0;
                            return (
                                <Pressable
                                    key={v.variante.id}
                                    onPress={() => seleccionar(v)}
                                    disabled={sinStock}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        paddingVertical: t.space['3'],
                                        paddingHorizontal: t.space['5'],
                                        borderBottomWidth: t.border.default,
                                        borderBottomColor: t.color.border.subtle,
                                        opacity: sinStock ? 0.4 : 1,
                                    }}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text variant="bodyMd" style={{ fontWeight: '600' }}>
                                            {v.variante.talla ?? 'Sin talla'}
                                        </Text>
                                        <Text variant="bodySm" tone="tertiary" mono style={{ marginTop: 2 }}>
                                            {v.variante.sku
                                                ? `SKU ${v.variante.sku}`
                                                : v.variante.codigoBarra
                                                    ? `CB ${v.variante.codigoBarra}`
                                                    : '—'}
                                            {v.stock !== null ? ` · Stock ${v.stock}` : ''}
                                        </Text>
                                    </View>
                                    <Text
                                        variant="bodyLg"
                                        mono
                                        style={{ color: t.color.accent.default }}
                                    >
                                        {formatCLP(v.precio)}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                ))}
            </ScrollView>
        </Sheet>
    );
}
