/**
 * Modal de aviso de expiración de sesión.
 * Muestra countdown y permite renovar o salir. Se dispara desde sessionMonitor.
 */
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { sessionMonitor } from '../../contexts/auth/application/SessionMonitor';
import { Sesion } from '../../contexts/auth/domain/Sesion';
import { SecureSesionStorage } from '../../contexts/auth/infrastructure/SecureSesionStorage';
import { container } from '../di/container';
import { useSesionStore } from '../stores/SesionStore';
import { useTheme } from '../theme/ThemeProvider';
import { Button, Sheet, Text } from './ui';

const storage = new SecureSesionStorage();

function secondsUntil(expiresAt: number | null): number {
    if (!expiresAt) return 0;
    return Math.max(0, Math.floor(expiresAt - Date.now() / 1000));
}

function formatMMSS(total: number): string {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export function SessionWarningModal() {
    const t = useTheme();
    const { sesion, setSesion, reset } = useSesionStore();
    const [open, setOpen] = useState(false);
    const [renovando, setRenovando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [countdown, setCountdown] = useState(0);
    const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const unsubscribe = sessionMonitor.subscribe((event) => {
            if (event === 'warn') {
                setError(null);
                setRenovando(false);
                setOpen(true);
                setCountdown(secondsUntil(sessionMonitor.getExpiresAt()));
            } else if (event === 'expire') {
                setOpen(false);
                forzarLogout();
            } else if (event === 'clear') {
                setOpen(false);
            }
        });
        return unsubscribe;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!open) {
            if (tickRef.current) {
                clearInterval(tickRef.current);
                tickRef.current = null;
            }
            return;
        }
        tickRef.current = setInterval(() => {
            setCountdown(secondsUntil(sessionMonitor.getExpiresAt()));
        }, 1000);
        return () => {
            if (tickRef.current) {
                clearInterval(tickRef.current);
                tickRef.current = null;
            }
        };
    }, [open]);

    const forzarLogout = () => {
        container.logout.execute().catch(() => undefined);
        sessionMonitor.clear();
        reset();
    };

    const mantenerSesion = async () => {
        if (!sesion?.refreshToken) {
            forzarLogout();
            return;
        }
        setRenovando(true);
        setError(null);
        try {
            const res = await container.refreshSession.execute(sesion.refreshToken);
            const nueva = Sesion.create({
                token: res.token,
                refreshToken: res.refreshToken,
                expiresAt: res.expiresAt,
                usuario: sesion.usuario,
            });
            await storage.guardar(nueva);
            setSesion(nueva);
            sessionMonitor.schedule(res.expiresAt);
            setOpen(false);
        } catch {
            setError('No se pudo renovar la sesión. Ingresá nuevamente.');
            setTimeout(forzarLogout, 1500);
        } finally {
            setRenovando(false);
        }
    };

    return (
        <Sheet
            visible={open}
            onClose={() => undefined}
            position="center"
            dismissOnBackdrop={false}
            title="Tu sesión está por expirar"
            footer={
                <View style={{ flexDirection: 'row', gap: t.space['2'] }}>
                    <Button
                        variant="ghost"
                        size="lg"
                        label="Salir"
                        onPress={forzarLogout}
                        disabled={renovando}
                        style={{ flex: 1 }}
                    />
                    <Button
                        variant="primary"
                        size="lg"
                        label="Mantener sesión"
                        onPress={mantenerSesion}
                        loading={renovando}
                        disabled={renovando}
                        style={{ flex: 1 }}
                    />
                </View>
            }
        >
            <Text variant="bodyMd" tone="secondary">
                Por seguridad, tu sesión se cerrará en{' '}
                <Text variant="bodyMd" mono style={{ fontWeight: '800', color: t.color.fg.primary }}>
                    {formatMMSS(countdown)}
                </Text>
                . ¿Quieres mantenerla activa o salir?
            </Text>
            {error ? (
                <Text
                    variant="bodySm"
                    style={{ color: t.color.feedback.dangerFg, marginTop: t.space['3'] }}
                >
                    {error}
                </Text>
            ) : null}
        </Sheet>
    );
}
