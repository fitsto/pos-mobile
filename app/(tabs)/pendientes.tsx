/**
 * Pantalla de operaciones offline pendientes de sincronización.
 * Lista cada operación con su estado (EN COLA / SINCRONIZANDO / ERROR),
 * permite reintentar o descartar, y ofrece "Sincronizar ahora" cuando hay red.
 */
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, View } from 'react-native';
import type { PendingOperation } from '../../src/contexts/offline-queue/domain/PendingOperation';
import {
    Badge,
    Button,
    Card,
    EmptyState,
    Screen,
    Text,
} from '../../src/runtime/components/ui';
import { offlineQueue, tryDrainQueue } from '../../src/runtime/offline/OfflineQueueManager';
import { selectFailedCount, useOfflineQueueStore } from '../../src/runtime/stores/OfflineQueueStore';
import { useTheme } from '../../src/runtime/theme/ThemeProvider';

function tipoLabel(t: PendingOperation['type']): string {
    switch (t) {
        case 'AJUSTE_STOCK':
            return 'Ajuste de stock';
        case 'TRANSFERIR_STOCK':
            return 'Transferencia de stock';
        case 'VENTA_PRESENCIAL':
            return 'Venta presencial';
        default:
            return t;
    }
}

function statusBadge(s: PendingOperation['status']): {
    label: string;
    tone: 'neutral' | 'accent' | 'danger';
} {
    switch (s) {
        case 'failed':
            return { label: 'ERROR', tone: 'danger' };
        case 'syncing':
            return { label: 'SINCRONIZANDO', tone: 'accent' };
        default:
            return { label: 'EN COLA', tone: 'neutral' };
    }
}

function formatHora(ts: number): string {
    return new Date(ts).toLocaleString();
}

export default function PendientesScreen() {
    const t = useTheme();
    const operaciones = useOfflineQueueStore((s) => s.operaciones);
    const online = useOfflineQueueStore((s) => s.online);
    const sincronizando = useOfflineQueueStore((s) => s.sincronizando);
    const failedCount = useOfflineQueueStore(selectFailedCount);
    const [refrescando, setRefrescando] = useState(false);

    useEffect(() => {
        void offlineQueue.refreshStore();
    }, []);

    const sincronizar = useCallback(async () => {
        setRefrescando(true);
        try {
            await tryDrainQueue();
        } finally {
            setRefrescando(false);
        }
    }, []);

    const reintentar = async (op: PendingOperation) => {
        await offlineQueue.retryOperation(op.id);
    };

    const descartar = (op: PendingOperation) => {
        Alert.alert(
            'Descartar operación',
            `¿Seguro que quieres descartar "${op.label}"? Los datos locales se perderán.`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Descartar',
                    style: 'destructive',
                    onPress: () => {
                        void offlineQueue.discardOperation(op.id);
                    },
                },
            ],
        );
    };

    const conexionTone: 'success' | 'danger' | 'neutral' =
        online === false ? 'danger' : online === true ? 'success' : 'neutral';
    const conexionLabel = online === false ? 'SIN RED' : online === true ? 'ONLINE' : '...';

    return (
        <Screen
            scroll={false}
            title="Pendientes"
            footer={
                operaciones.length > 0 && online !== false ? (
                    <Button
                        variant="primary"
                        size="lg"
                        label="Sincronizar ahora"
                        onPress={sincronizar}
                        loading={refrescando || sincronizando}
                        fullWidth
                    />
                ) : undefined
            }
        >
            <ScrollView
                contentContainerStyle={{ gap: t.space['3'], paddingBottom: t.space['6'] }}
                refreshControl={
                    <RefreshControl
                        refreshing={refrescando}
                        onRefresh={sincronizar}
                        tintColor={t.color.fg.primary}
                    />
                }
            >
                <Card variant="subtle" padding={4}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text variant="label" tone="tertiary">CONEXIÓN</Text>
                        <Badge label={conexionLabel} tone={conexionTone} />
                    </View>
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: t.space['3'],
                            paddingTop: t.space['3'],
                            borderTopWidth: t.border.default,
                            borderTopColor: t.color.border.subtle,
                        }}
                    >
                        <Text variant="label" tone="tertiary">EN COLA</Text>
                        <Text variant="bodyLg" mono>{operaciones.length}</Text>
                    </View>
                    {failedCount > 0 ? (
                        <View
                            style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginTop: t.space['2'],
                            }}
                        >
                            <Text variant="label" tone="tertiary">CON ERROR</Text>
                            <Text variant="bodyLg" mono style={{ color: t.color.feedback.dangerFg }}>
                                {failedCount}
                            </Text>
                        </View>
                    ) : null}
                    {sincronizando ? (
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: t.space['2'],
                                marginTop: t.space['3'],
                            }}
                        >
                            <ActivityIndicator color={t.color.accent.default} />
                            <Text variant="bodySm" tone="secondary">Sincronizando...</Text>
                        </View>
                    ) : null}
                </Card>

                {operaciones.length === 0 ? (
                    <EmptyState
                        icon={
                            <Ionicons
                                name="checkmark-done-outline"
                                size={40}
                                color={t.color.fg.tertiary}
                            />
                        }
                        title="Todo al día"
                        description="No hay operaciones pendientes de sincronización."
                    />
                ) : null}

                {operaciones.map((op) => {
                    const badge = statusBadge(op.status);
                    return (
                        <Card key={op.id} variant="outline" padding={4}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: t.space['2'] }}>
                                <View style={{ flex: 1, gap: 2 }}>
                                    <Text variant="bodyMd" style={{ fontWeight: '700' }}>{op.label}</Text>
                                    <Text variant="bodySm" tone="tertiary">
                                        {tipoLabel(op.type)} · {formatHora(op.createdAt)}
                                    </Text>
                                </View>
                                <Badge label={badge.label} tone={badge.tone} />
                            </View>

                            {op.attempts > 0 ? (
                                <Text variant="bodySm" tone="tertiary" style={{ marginTop: t.space['2'] }}>
                                    {op.attempts} intentos
                                </Text>
                            ) : null}

                            {op.lastError ? (
                                <Text
                                    variant="bodySm"
                                    style={{ color: t.color.feedback.dangerFg, marginTop: t.space['2'] }}
                                    numberOfLines={3}
                                >
                                    {op.lastError}
                                </Text>
                            ) : null}

                            <View style={{ flexDirection: 'row', gap: t.space['2'], marginTop: t.space['3'] }}>
                                {op.status === 'failed' ? (
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        label="Reintentar"
                                        onPress={() => reintentar(op)}
                                    />
                                ) : null}
                                <Button
                                    variant="danger"
                                    size="sm"
                                    label="Descartar"
                                    onPress={() => descartar(op)}
                                />
                            </View>
                        </Card>
                    );
                })}
            </ScrollView>
        </Screen>
    );
}
