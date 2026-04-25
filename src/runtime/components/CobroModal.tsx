/**
 * Modal de cobro: selector de medio de pago, monto recibido en EFECTIVO
 * con cálculo de vuelto, y confirmación. Usa Sheet + primitivos.
 */
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import type { Carrito } from '../../contexts/venta/domain/Carrito';
import { MedioPago, MEDIOS_PAGO_PRESENCIAL } from '../../contexts/venta/domain/MedioPago';
import { useTheme } from '../theme/ThemeProvider';
import { formatCLP } from '../utils/formato';
import { Button, Chip, Sheet, Text, TextField } from './ui';

interface Props {
    visible: boolean;
    carrito: Carrito;
    onClose: () => void;
    onConfirmar: (args: { medioPago: MedioPago; montoRecibido?: number }) => Promise<void>;
}

const etiquetas: Record<MedioPago, string> = {
    EFECTIVO: 'Efectivo',
    DEBITO: 'Débito',
    CREDITO: 'Crédito',
    TRANSFERENCIA: 'Transferencia',
};

export function CobroModal({ visible, carrito, onClose, onConfirmar }: Props) {
    const t = useTheme();
    const [medio, setMedio] = useState<MedioPago>(MedioPago.EFECTIVO);
    const [montoRecibidoRaw, setMontoRecibidoRaw] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);

    const total = carrito.subtotal;
    const montoRecibido = useMemo(() => {
        const n = Number(montoRecibidoRaw.replace(/[^\d]/g, ''));
        return Number.isFinite(n) ? n : 0;
    }, [montoRecibidoRaw]);
    const vuelto = medio === MedioPago.EFECTIVO ? montoRecibido - total : 0;
    const puedeCobrar =
        !enviando && (medio !== MedioPago.EFECTIVO || montoRecibido >= total);

    const reset = () => {
        setMedio(MedioPago.EFECTIVO);
        setMontoRecibidoRaw('');
        setError(null);
        setEnviando(false);
    };

    const handleClose = () => {
        if (!enviando) {
            reset();
            onClose();
        }
    };

    const confirmar = async () => {
        setError(null);
        setEnviando(true);
        try {
            await onConfirmar({
                medioPago: medio,
                montoRecibido: medio === MedioPago.EFECTIVO ? montoRecibido : undefined,
            });
            reset();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al cobrar');
            setEnviando(false);
        }
    };

    return (
        <Sheet
            visible={visible}
            onClose={handleClose}
            title="Cobrar"
            dismissOnBackdrop={!enviando}
            footer={
                <View style={{ flexDirection: 'row', gap: t.space['2'] }}>
                    <Button
                        variant="secondary"
                        size="lg"
                        label="Cancelar"
                        onPress={handleClose}
                        disabled={enviando}
                        style={{ flex: 1 }}
                    />
                    <Button
                        variant="primary"
                        size="lg"
                        label="Cobrar"
                        onPress={confirmar}
                        disabled={!puedeCobrar}
                        loading={enviando}
                        style={{ flex: 1 }}
                    />
                </View>
            }
        >
            <Text variant="label" tone="tertiary">A COBRAR</Text>
            <Text
                variant="displayLg"
                mono
                style={{ color: t.color.accent.default, marginTop: 4 }}
            >
                {formatCLP(total)}
            </Text>

            <Text variant="label" tone="tertiary" style={{ marginTop: t.space['5'] }}>
                MEDIO DE PAGO
            </Text>
            <View
                style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: t.space['2'],
                    marginTop: t.space['2'],
                }}
            >
                {MEDIOS_PAGO_PRESENCIAL.map((m) => (
                    <Chip
                        key={m}
                        label={etiquetas[m]}
                        selected={m === medio}
                        onPress={() => setMedio(m)}
                    />
                ))}
            </View>

            {medio === MedioPago.EFECTIVO ? (
                <View style={{ marginTop: t.space['4'] }}>
                    <TextField
                        label="Monto recibido"
                        value={montoRecibidoRaw}
                        onChangeText={setMontoRecibidoRaw}
                        placeholder="0"
                        keyboardType="number-pad"
                        mono
                    />
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: t.space['3'],
                        }}
                    >
                        <Text variant="label" tone="tertiary">VUELTO</Text>
                        <Text
                            variant="headingLg"
                            mono
                            style={{
                                color:
                                    vuelto < 0
                                        ? t.color.feedback.dangerFg
                                        : t.color.feedback.successFg,
                            }}
                        >
                            {vuelto < 0 ? `Falta ${formatCLP(-vuelto)}` : formatCLP(vuelto)}
                        </Text>
                    </View>
                </View>
            ) : null}

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
