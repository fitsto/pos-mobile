/**
 * Pantalla de cuenta: datos del operador + cambio de negocio + logout.
 * También permite alternar el modo de tema (light/dark/system).
 */
import { Linking, Pressable, View } from 'react-native';
import { Button, Card, Chip, Screen, Text } from '../../src/runtime/components/ui';
import { container } from '../../src/runtime/di/container';
import { useSesionStore } from '../../src/runtime/stores/SesionStore';
import { useTheme, useThemeMode } from '../../src/runtime/theme/ThemeProvider';

function Row({ label, value }: { label: string; value: string }) {
    const t = useTheme();
    return (
        <View
            style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                paddingVertical: t.space['2'],
                borderBottomWidth: t.border.default,
                borderBottomColor: t.color.border.subtle,
            }}
        >
            <Text variant="label" tone="tertiary">{label}</Text>
            <Text variant="bodyMd" style={{ flexShrink: 1, textAlign: 'right' }}>{value}</Text>
        </View>
    );
}

export default function CuentaScreen() {
    const t = useTheme();
    const { mode, setMode } = useThemeMode();
    const sesion = useSesionStore((s) => s.sesion);
    const negocio = useSesionStore((s) => s.negocio);
    const reset = useSesionStore((s) => s.reset);
    const setNegocio = useSesionStore((s) => s.setNegocio);

    async function logout() {
        await container.logout.execute();
        reset();
    }

    return (
        <Screen scroll title="Mi cuenta">
            <Card variant="subtle" padding={4}>
                <Row label="Usuario" value={sesion?.usuario.email ?? '—'} />
                <Row label="Tienda" value={negocio?.nombre ?? '—'} />
                <Row label="Rol" value={negocio?.rol ?? '—'} />
                {negocio?.ubicacionNombre ? (
                    <Row label="Ubicación" value={negocio.ubicacionNombre} />
                ) : null}
            </Card>

            <Text variant="label" tone="tertiary" style={{ marginTop: t.space['5'], marginBottom: t.space['2'] }}>
                TEMA
            </Text>
            <View style={{ flexDirection: 'row', gap: t.space['2'] }}>
                <Chip label="Sistema" selected={mode === 'system'} onPress={() => setMode('system')} />
                <Chip label="Claro" selected={mode === 'light'} onPress={() => setMode('light')} />
                <Chip label="Oscuro" selected={mode === 'dark'} onPress={() => setMode('dark')} />
            </View>

            <View style={{ gap: t.space['2'], marginTop: t.space['6'] }}>
                <Button
                    variant="secondary"
                    label="Cambiar de negocio"
                    onPress={() => setNegocio(null)}
                    fullWidth
                />
                <Button
                    variant="danger"
                    label="Cerrar sesión"
                    onPress={logout}
                    fullWidth
                />
            </View>

            <Text variant="label" tone="tertiary" style={{ marginTop: t.space['6'], marginBottom: t.space['2'] }}>
                ATRIBUCIONES
            </Text>
            <Card variant="subtle" padding={4}>
                <Text variant="bodySm" tone="secondary">
                    Información de productos (nombre, marca, imagen) provista por{' '}
                    <Pressable onPress={() => Linking.openURL('https://world.openfoodfacts.org')}>
                        <Text variant="bodySm" style={{ textDecorationLine: 'underline' }}>
                            Open Food Facts
                        </Text>
                    </Pressable>
                    , bajo licencia ODbL. Los datos pueden ser editados por la comunidad y no
                    son responsabilidad de esta aplicación.
                </Text>
            </Card>
        </Screen>
    );
}
