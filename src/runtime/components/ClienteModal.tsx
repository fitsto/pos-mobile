/**
 * Modal de registro / búsqueda de cliente para una venta.
 * Flujo: inicio → tengo RUT (busca; si existe, usa; si no, registra) o
 * saltar (venta queda sin cliente). El RUT es obligatorio para asociar
 * un cliente — si el comprador no lo da, se usa "Saltar".
 */
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { Cliente } from '../../contexts/cliente/domain/Cliente';
import { esRutValido, validarRut } from '../../contexts/cliente/domain/rut';
import type { ClienteDataInput } from '../../contexts/venta/domain/VentaRepository';
import { container } from '../di/container';
import { useTheme } from '../theme/ThemeProvider';
import { Button, Sheet, Text, TextField } from './ui';

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

type Paso = 'inicio' | 'conRut' | 'formularioConRut';

export function ClienteModal({ visible, negocioId, token, onClose, onResuelto }: Props) {
    const t = useTheme();
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

    // RUT formateado para mostrar en el resumen (paso "formularioConRut").
    // Sólo cosmético — el valor que se valida y se envía es `rutRaw`.
    const formatearRutParaMostrar = (raw: string): string => {
        const limpio = raw.toUpperCase().replace(/[^0-9K]/g, '');
        if (limpio.length < 2) return limpio;
        const cuerpo = limpio.slice(0, -1);
        const dv = limpio.slice(-1);
        const cuerpoConPuntos = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return `${cuerpoConPuntos}-${dv}`;
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

    // Decisión: NO formateamos el RUT mientras se tipea ni en blur.
    // En React Native, mutar `value` desde onChangeText reposiciona el
    // cursor y produce dígitos duplicados o perdidos. Para evitar todo
    // ese baile pedimos el RUT como string puro: dígitos + DV (donde DV
    // puede ser `K`). El usuario ve un hint que se lo indica.
    const onChangeRut = (val: string) => {
        const limpio = val.toUpperCase().replace(/[^0-9K]/g, '').slice(0, 9);
        setRutRaw(limpio);
        setEncontrado(null);
        setRutError(null);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => buscarRut(limpio), 400);
    };

    const confirmarEncontrado = () => {
        if (!encontrado) return;
        onResuelto({
            tipo: 'customerId',
            customerId: encontrado.id,
            nombreMostrado: encontrado.name,
        });
    };

    const confirmarFormulario = () => {
        setFormError(null);
        const nombreLimpio = nombre.trim();
        if (!nombreLimpio) {
            setFormError('El nombre es obligatorio');
            return;
        }
        let rutNorm: string;
        try {
            rutNorm = validarRut(rutRaw);
        } catch (e) {
            setFormError(e instanceof Error ? e.message : 'RUT inválido');
            return;
        }
        const data: ClienteDataInput = {
            name: nombreLimpio,
            rut: rutNorm,
            ...(email.trim() && { email: email.trim() }),
            ...(telefono.trim() && { telefono: telefono.trim() }),
        };
        onResuelto({ tipo: 'clienteData', data, nombreMostrado: nombreLimpio });
    };

    const saltar = () => onResuelto({ tipo: 'skip' });

    return (
        <Sheet
            visible={visible}
            onClose={onClose}
            title="¿Registrar cliente?"
            subtitle={paso === 'inicio' ? 'Asocia esta venta a un cliente' : undefined}
        >
            {paso === 'inicio' ? (
                <View style={{ gap: t.space['2'] }}>
                    <Button
                        variant="primary"
                        size="lg"
                        label="Tengo RUT"
                        onPress={() => setPaso('conRut')}
                        fullWidth
                    />
                    <Button
                        variant="ghost"
                        size="lg"
                        label="Saltar"
                        onPress={saltar}
                        fullWidth
                    />
                </View>
            ) : null}

            {paso === 'conRut' ? (
                <View style={{ gap: t.space['3'] }}>
                    <TextField
                        label="RUT"
                        value={rutRaw}
                        onChangeText={onChangeRut}
                        placeholder="123456789"
                        helper="Sin puntos ni guión. Incluye el dígito verificador (puede ser K)."
                        autoCapitalize="characters"
                        autoCorrect={false}
                        keyboardType="default"
                        maxLength={9}
                        error={rutError ?? undefined}
                        mono
                    />
                    {buscando ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space['2'] }}>
                            <ActivityIndicator color={t.color.accent.default} />
                            <Text variant="bodySm" tone="secondary">Buscando cliente…</Text>
                        </View>
                    ) : null}
                    {encontrado && !buscando ? (
                        <View
                            style={{
                                padding: t.space['3'],
                                backgroundColor: t.color.feedback.successBg,
                                borderRadius: t.radius.md,
                                borderWidth: t.border.default,
                                borderColor: t.color.feedback.successFg,
                            }}
                        >
                            <Text variant="bodyMd" style={{ fontWeight: '700' }}>{encontrado.name}</Text>
                            <Text variant="bodySm" tone="tertiary" mono style={{ marginTop: 2 }}>
                                {encontrado.rut ?? '—'} · {encontrado.totalCompras} compras
                            </Text>
                        </View>
                    ) : null}
                    <View style={{ flexDirection: 'row', gap: t.space['2'], marginTop: t.space['2'] }}>
                        <Button
                            variant="ghost"
                            size="lg"
                            label="Atrás"
                            onPress={() => setPaso('inicio')}
                            style={{ flex: 1 }}
                        />
                        {encontrado ? (
                            <Button
                                variant="primary"
                                size="lg"
                                label="Usar cliente"
                                onPress={confirmarEncontrado}
                                style={{ flex: 1 }}
                            />
                        ) : (
                            <Button
                                variant="primary"
                                size="lg"
                                label="Registrar nuevo"
                                disabled={!esRutValido(rutRaw) || buscando}
                                onPress={() => {
                                    setNombre('');
                                    setEmail('');
                                    setTelefono('');
                                    setPaso('formularioConRut');
                                }}
                                style={{ flex: 1 }}
                            />
                        )}
                    </View>
                </View>
            ) : null}

            {paso === 'formularioConRut' ? (
                <View style={{ gap: t.space['3'] }}>
                    <TextField
                        label="RUT"
                        value={formatearRutParaMostrar(rutRaw)}
                        editable={false}
                        mono
                    />
                    <TextField
                        label="Nombre"
                        required
                        value={nombre}
                        onChangeText={setNombre}
                        placeholder="Nombre del cliente"
                    />
                    <TextField
                        label="Teléfono"
                        value={telefono}
                        onChangeText={setTelefono}
                        placeholder="+56 9…"
                        keyboardType="phone-pad"
                        mono
                    />
                    <TextField
                        label="Email"
                        value={email}
                        onChangeText={setEmail}
                        placeholder="correo@ejemplo.cl"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        error={formError ?? undefined}
                    />
                    <View style={{ flexDirection: 'row', gap: t.space['2'], marginTop: t.space['2'] }}>
                        <Button
                            variant="ghost"
                            size="lg"
                            label="Atrás"
                            onPress={() => setPaso('conRut')}
                            style={{ flex: 1 }}
                        />
                        <Button
                            variant="primary"
                            size="lg"
                            label="Confirmar"
                            onPress={confirmarFormulario}
                            style={{ flex: 1 }}
                        />
                    </View>
                </View>
            ) : null}
        </Sheet>
    );
}
