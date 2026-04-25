/**
 * Selección de negocio post-login. Si el usuario tiene uno solo, se
 * auto-selecciona y el guard del layout lo manda al POS.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import type { Tienda } from '../src/contexts/tienda/domain/Tienda';
import { Button, ListItem, Screen, Text } from '../src/runtime/components/ui';
import { container } from '../src/runtime/di/container';
import { useSesionStore } from '../src/runtime/stores/SesionStore';
import { useTheme } from '../src/runtime/theme/ThemeProvider';

export default function SeleccionarNegocioScreen() {
    const t = useTheme();
    const sesion = useSesionStore((s) => s.sesion);
    const setNegocio = useSesionStore((s) => s.setNegocio);
    const logout = useSesionStore((s) => s.reset);
    const [negocios, setNegocios] = useState<Tienda[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!sesion) return;
        container.listarMisNegocios
            .execute(sesion.token)
            .then((res) => {
                setNegocios(res);
                if (res.length === 1) setNegocio(res[0]);
            })
            .catch(() => setError('No pudimos traer tus negocios'))
            .finally(() => setCargando(false));
    }, [sesion, setNegocio]);

    async function cerrarSesion() {
        await container.logout.execute();
        logout();
    }

    if (cargando) {
        return (
            <Screen edges={['top', 'bottom']}>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator color={t.color.accent.default} />
                </View>
            </Screen>
        );
    }

    return (
        <Screen
            edges={['top', 'bottom']}
            title="Elige una tienda"
            subtitle="Selecciona con cuál vas a trabajar en esta sesión."
            paddingH={0}
            footer={
                <Button
                    variant="ghost"
                    label="Cerrar sesión"
                    onPress={cerrarSesion}
                    fullWidth
                />
            }
        >
            {error ? (
                <Text variant="bodySm" tone="danger" style={{ paddingHorizontal: t.space['4'], marginBottom: t.space['2'] }}>
                    {error}
                </Text>
            ) : null}
            <FlatList
                data={negocios}
                keyExtractor={(n) => n.id}
                contentContainerStyle={{ paddingVertical: t.space['2'] }}
                ItemSeparatorComponent={() => (
                    <View style={{ height: 1, backgroundColor: t.color.border.subtle, marginLeft: t.space['4'] }} />
                )}
                renderItem={({ item }) => (
                    <ListItem
                        title={item.nombre}
                        subtitle={`${item.rol}${item.ubicacionNombre ? ` · ${item.ubicacionNombre}` : ''}`}
                        trailing={<Ionicons name="chevron-forward" size={20} color={t.color.fg.tertiary} />}
                        onPress={() => setNegocio(item)}
                    />
                )}
                ListEmptyComponent={
                    <View style={{ padding: t.space['6'] }}>
                        <Text variant="bodyMd" tone="tertiary" align="center">
                            No tienes tiendas asignadas.
                        </Text>
                    </View>
                }
            />
        </Screen>
    );
}
