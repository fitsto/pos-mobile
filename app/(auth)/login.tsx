/**
 * Login — autenticación de operadores (admin / cajero / vendedor).
 * Consume identity-central (Better Auth).
 */
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { env } from '../../src/contexts/shared/infrastructure/config/env';
import { DomainError } from '../../src/contexts/shared/domain/DomainError';
import { HttpError } from '../../src/contexts/shared/infrastructure/http/HttpClient';
import { Button, Text, TextField } from '../../src/runtime/components/ui';
import { container } from '../../src/runtime/di/container';
import { useSesionStore } from '../../src/runtime/stores/SesionStore';
import { useTheme } from '../../src/runtime/theme/ThemeProvider';

export default function LoginScreen() {
    const t = useTheme();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [cargando, setCargando] = useState(false);
    const setSesion = useSesionStore((s) => s.setSesion);

    async function onSubmit() {
        setError(null);
        setCargando(true);
        try {
            const sesion = await container.login.execute({ email, password });
            setSesion(sesion);
        } catch (err) {
            let msg: string;
            if (err instanceof DomainError) msg = err.message;
            else if (err instanceof HttpError)
                msg = err.status === 401 ? 'Credenciales inválidas' : `Error del servidor (HTTP ${err.status})`;
            else if (err instanceof Error) msg = `No se pudo conectar a ${env.apiUrl}: ${err.message}`;
            else msg = 'Error desconocido';
            setError(msg);
        } finally {
            setCargando(false);
        }
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: t.color.bg.canvas }}>
            <View
                style={{
                    flex: 1,
                    padding: t.space['6'],
                    justifyContent: 'center',
                }}
            >
                {/* Brand */}
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: t.space['3'],
                        marginBottom: t.space['10'],
                    }}
                >
                    <View
                        style={{
                            width: 28,
                            height: 28,
                            backgroundColor: t.color.accent.default,
                            borderRadius: t.radius.sm,
                            transform: [{ rotate: '45deg' }],
                        }}
                    />
                    <Text variant="displayMd" style={{ letterSpacing: 4 }}>POS</Text>
                </View>

                <Text variant="displayLg">Ingresa a tu caja</Text>
                <Text variant="bodyMd" tone="secondary" style={{ marginTop: t.space['2'], marginBottom: t.space['8'] }}>
                    Usa el correo y la contraseña de tu cuenta.
                </Text>

                <TextField
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="vos@negocio.com"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    accessibilityLabel="Email"
                    style={{ marginBottom: t.space['4'] }}
                />
                <TextField
                    label="Contraseña"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    secureTextEntry
                    accessibilityLabel="Contraseña"
                    error={error ?? undefined}
                    style={{ marginBottom: t.space['4'] }}
                />

                <Button
                    label="Ingresar"
                    onPress={onSubmit}
                    loading={cargando}
                    disabled={cargando}
                    size="lg"
                    fullWidth
                    style={{ marginTop: t.space['2'] }}
                />
            </View>
        </SafeAreaView>
    );
}
