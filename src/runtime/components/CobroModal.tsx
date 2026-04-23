import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radius, spacing, type } from '../theme/tokens';
import { formatCLP } from '../utils/formato';
import { MedioPago, MEDIOS_PAGO_PRESENCIAL } from '../../contexts/venta/domain/MedioPago';
import type { Carrito } from '../../contexts/venta/domain/Carrito';

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

  const handleClose = () => { if (!enviando) { reset(); onClose(); } };

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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.label}>A cobrar</Text>
          <Text style={styles.total}>{formatCLP(total)}</Text>

          <Text style={styles.label}>Medio de pago</Text>
          <View style={styles.mediosRow}>
            {MEDIOS_PAGO_PRESENCIAL.map((m) => {
              const activo = m === medio;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMedio(m)}
                  style={[styles.medio, activo && styles.medioActivo]}
                >
                  <Text style={[styles.medioText, activo && styles.medioTextActivo]}>
                    {etiquetas[m]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {medio === MedioPago.EFECTIVO && (
            <>
              <Text style={styles.label}>Monto recibido</Text>
              <TextInput
                value={montoRecibidoRaw}
                onChangeText={setMontoRecibidoRaw}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                style={styles.input}
              />
              <View style={styles.vueltoRow}>
                <Text style={styles.vueltoLabel}>Vuelto</Text>
                <Text
                  style={[
                    styles.vueltoValue,
                    vuelto < 0 && { color: colors.danger },
                  ]}
                >
                  {vuelto < 0 ? `Falta ${formatCLP(-vuelto)}` : formatCLP(vuelto)}
                </Text>
              </View>
            </>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, styles.btnGhost]}
              onPress={handleClose}
              disabled={enviando}
            >
              <Text style={styles.btnGhostText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary, !puedeCobrar && styles.btnDisabled]}
              onPress={confirmar}
              disabled={!puedeCobrar}
            >
              {enviando
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.btnPrimaryText}>Cobrar</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  label: { ...type.label, color: colors.textMuted, marginTop: spacing.md },
  total: { ...type.display, color: colors.accent, marginVertical: spacing.sm },
  mediosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  medio: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  medioActivo: { backgroundColor: colors.accent, borderColor: colors.accent },
  medioText: { color: colors.text, ...type.body },
  medioTextActivo: { color: '#000', fontWeight: '700' },
  input: {
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  vueltoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  vueltoLabel: { ...type.label, color: colors.textMuted },
  vueltoValue: { ...type.title, color: colors.success },
  error: { color: colors.danger, marginTop: spacing.md, ...type.body },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  btn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.text, ...type.label },
  btnPrimary: { backgroundColor: colors.accent },
  btnPrimaryText: { color: '#000', ...type.label },
  btnDisabled: { opacity: 0.5 },
});
