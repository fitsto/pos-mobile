import { useEffect, useRef, useState } from 'react';
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
import { container } from '../di/container';
import { esRutValido, validarRut } from '../../contexts/cliente/domain/rut';
import type { Cliente } from '../../contexts/cliente/domain/Cliente';
import type { ClienteDataInput } from '../../contexts/venta/domain/VentaRepository';

export type ClienteResuelto =
  | { tipo: 'customerId'; customerId: string; nombreMostrado: string }
  | { tipo: 'clienteData'; data: ClienteDataInput; nombreMostrado: string }
  | { tipo: 'skip' };

interface Props {
  visible: boolean;
  negocioId: string;
  token: string;
  onClose: () => void;
  onResuelto: (r: ClienteResuelto) => void;
}

type Paso =
  | 'inicio'
  | 'conRut'
  | 'formularioConRut'
  | 'formularioSinRut';

export function ClienteModal({ visible, negocioId, token, onClose, onResuelto }: Props) {
  const [paso, setPaso] = useState<Paso>('inicio');
  const [rutRaw, setRutRaw] = useState('');
  const [rutError, setRutError] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [encontrado, setEncontrado] = useState<Cliente | null>(null);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = () => {
    setPaso('inicio');
    setRutRaw('');
    setRutError(null);
    setBuscando(false);
    setEncontrado(null);
    setNombre('');
    setEmail('');
    setTelefono('');
    setFormError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  useEffect(() => {
    if (!visible) reset();
  }, [visible]);

  const buscarRut = (valor: string) => {
    setEncontrado(null);
    setRutError(null);
    const limpio = valor.trim();
    if (!limpio) return;
    if (!esRutValido(limpio)) {
      setRutError('RUT inválido');
      return;
    }
    setBuscando(true);
    container.buscarClientePorRut
      .execute({ negocioId, rut: limpio, token })
      .then((c) => setEncontrado(c))
      .catch((e) => setRutError(e instanceof Error ? e.message : 'Error al buscar'))
      .finally(() => setBuscando(false));
  };

  const onChangeRut = (t: string) => {
    setRutRaw(t);
    setEncontrado(null);
    setRutError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscarRut(t), 400);
  };

  const confirmarEncontrado = () => {
    if (!encontrado) return;
    onResuelto({
      tipo: 'customerId',
      customerId: encontrado.id,
      nombreMostrado: encontrado.name,
    });
  };

  const confirmarFormulario = (conRut: boolean) => {
    setFormError(null);
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      setFormError('El nombre es obligatorio');
      return;
    }
    let rutNorm: string | undefined;
    if (conRut) {
      try {
        rutNorm = validarRut(rutRaw);
      } catch (e) {
        setFormError(e instanceof Error ? e.message : 'RUT inválido');
        return;
      }
    }
    const data: ClienteDataInput = {
      name: nombreLimpio,
      ...(rutNorm && { rut: rutNorm }),
      ...(email.trim() && { email: email.trim() }),
      ...(telefono.trim() && { telefono: telefono.trim() }),
    };
    onResuelto({ tipo: 'clienteData', data, nombreMostrado: nombreLimpio });
  };

  const saltar = () => onResuelto({ tipo: 'skip' });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.titulo}>¿Registrar cliente?</Text>

          {paso === 'inicio' && (
            <View style={{ gap: spacing.md, marginTop: spacing.md }}>
              <Pressable style={styles.btnPrimary} onPress={() => setPaso('conRut')}>
                <Text style={styles.btnPrimaryText}>Tengo RUT</Text>
              </Pressable>
              <Pressable
                style={styles.btnSecondary}
                onPress={() => {
                  setPaso('formularioSinRut');
                }}
              >
                <Text style={styles.btnSecondaryText}>Sin RUT — datos básicos</Text>
              </Pressable>
              <Pressable style={styles.btnGhost} onPress={saltar}>
                <Text style={styles.btnGhostText}>Saltar</Text>
              </Pressable>
            </View>
          )}

          {paso === 'conRut' && (
            <View style={{ marginTop: spacing.md }}>
              <Text style={styles.label}>RUT</Text>
              <TextInput
                value={rutRaw}
                onChangeText={onChangeRut}
                placeholder="12345678-9"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {rutError && <Text style={styles.error}>{rutError}</Text>}
              {buscando && (
                <View style={styles.estadoRow}>
                  <ActivityIndicator color={colors.accent} />
                  <Text style={styles.estadoText}>Buscando cliente…</Text>
                </View>
              )}
              {encontrado && !buscando && (
                <View style={styles.encontradoBox}>
                  <Text style={styles.encontradoNombre}>{encontrado.name}</Text>
                  <Text style={styles.encontradoMeta}>
                    {encontrado.rut ?? '—'} · {encontrado.totalCompras} compras
                  </Text>
                </View>
              )}
              <View style={styles.actions}>
                <Pressable style={styles.btnGhost} onPress={() => setPaso('inicio')}>
                  <Text style={styles.btnGhostText}>Atrás</Text>
                </Pressable>
                {encontrado ? (
                  <Pressable style={styles.btnPrimary} onPress={confirmarEncontrado}>
                    <Text style={styles.btnPrimaryText}>Usar cliente</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={[
                      styles.btnPrimary,
                      (!esRutValido(rutRaw) || buscando) && styles.btnDisabled,
                    ]}
                    disabled={!esRutValido(rutRaw) || buscando}
                    onPress={() => {
                      // RUT válido pero sin match → pasar al formulario con RUT.
                      setNombre('');
                      setEmail('');
                      setTelefono('');
                      setPaso('formularioConRut');
                    }}
                  >
                    <Text style={styles.btnPrimaryText}>Registrar nuevo</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {(paso === 'formularioConRut' || paso === 'formularioSinRut') && (
            <View style={{ marginTop: spacing.md }}>
              {paso === 'formularioConRut' && (
                <>
                  <Text style={styles.label}>RUT</Text>
                  <TextInput
                    value={rutRaw}
                    editable={false}
                    style={[styles.input, { opacity: 0.7 }]}
                  />
                </>
              )}
              <Text style={styles.label}>Nombre *</Text>
              <TextInput
                value={nombre}
                onChangeText={setNombre}
                placeholder="Nombre del cliente"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              <Text style={styles.label}>Teléfono</Text>
              <TextInput
                value={telefono}
                onChangeText={setTelefono}
                placeholder="+56 9…"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                keyboardType="phone-pad"
              />
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="correo@ejemplo.cl"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {formError && <Text style={styles.error}>{formError}</Text>}
              <View style={styles.actions}>
                <Pressable
                  style={styles.btnGhost}
                  onPress={() => setPaso(paso === 'formularioConRut' ? 'conRut' : 'inicio')}
                >
                  <Text style={styles.btnGhostText}>Atrás</Text>
                </Pressable>
                <Pressable
                  style={styles.btnPrimary}
                  onPress={() => confirmarFormulario(paso === 'formularioConRut')}
                >
                  <Text style={styles.btnPrimaryText}>Confirmar</Text>
                </Pressable>
              </View>
            </View>
          )}
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
  titulo: { ...type.title, color: colors.text },
  label: { ...type.label, color: colors.textMuted, marginTop: spacing.md },
  input: {
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    ...type.body,
  },
  error: { color: colors.danger, marginTop: spacing.sm, ...type.body },
  estadoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  estadoText: { color: colors.textMuted, ...type.body },
  encontradoBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.success,
  },
  encontradoNombre: { color: colors.text, ...type.body, fontWeight: '700' },
  encontradoMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  btnPrimary: {
    flex: 1,
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#000', ...type.label },
  btnSecondary: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  btnSecondaryText: { color: colors.text, ...type.label },
  btnGhost: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  btnGhostText: { color: colors.textMuted, ...type.label },
  btnDisabled: { opacity: 0.4 },
});
