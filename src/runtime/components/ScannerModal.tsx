/**
 * Modal de escaneo de códigos de barras.
 *
 * Soporta dos modos:
 *   - 'single' (default): escanea uno y cierra automáticamente.
 *   - 'multi':            escanea N códigos seguidos, con feedback de cada uno
 *                         (haptic + sonido + toast efímero), sin cerrar la
 *                         cámara hasta que el usuario pulse "Listo". Útil para
 *                         cargar muchos productos al carrito sin reabrir la
 *                         cámara cada vez.
 *
 * Para evitar lecturas duplicadas (la cámara dispara `onBarcodeScanned`
 * varias veces por segundo cuando el código está enfocado), bloqueamos el
 * callback durante ~1.2 s después de cada hit. En modo single, ese bloqueo
 * dura hasta que el modal se cierra/reabre.
 *
 * El feedback visual usa `lastScanLabel` que el padre nos pasa después de
 * resolver el código. Si el padre no resuelve nada (p. ej. código no
 * encontrado), nosotros mostramos un fallback con el código crudo.
 */
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Button, Text } from './ui';

export type ScannerMode = 'single' | 'multi';

interface Props {
    visible: boolean;
    onClose: () => void;
    onScan: (codigo: string) => void;
    /** 'single' | 'multi'. Default 'single'. */
    mode?: ScannerMode;
    /** Permite al padre forzar cambio de modo desde afuera. */
    onModeChange?: (mode: ScannerMode) => void;
    /**
     * Texto a mostrar como flash de confirmación tras un escaneo en modo multi
     * (e.g. "✓ Coca-Cola 1.5L (x3)"). El padre lo setea al resolver el código.
     */
    lastScanFlash?: string | null;
    /**
     * Contador que el padre incrementa en cada escaneo resuelto. Usamos esto
     * (no el texto) como trigger del flash, así dos escaneos consecutivos del
     * mismo producto siguen flasheando aunque el texto sea idéntico, sin
     * recurrir a hacks como zero-width-space en el string.
     */
    flashKey?: number;
}

const COOLDOWN_MS = 2200;
const FLASH_MS = 1500;

// Asset de beep — opcional. Si no existe en `assets/sounds/scan-beep.mp3`
// el require falla silenciosamente y solo queda el haptic. El path se
// resuelve en build-time con `require`.
let beepAsset: number | null = null;
try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    beepAsset = require('../../../assets/sounds/scan-beep.wav');
} catch {
    beepAsset = null;
}

export function ScannerModal({
    visible,
    onClose,
    onScan,
    mode = 'single',
    onModeChange,
    lastScanFlash,
    flashKey,
}: Props) {
    const t = useTheme();
    const [permission, requestPermission] = useCameraPermissions();
    const [bloqueado, setBloqueado] = useState(false);
    const [flashTexto, setFlashTexto] = useState<string | null>(null);
    const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (visible) setBloqueado(false);
        // Limpiamos timers al cerrar para no flashear texto en el próximo open.
        if (!visible) {
            if (cooldownRef.current) clearTimeout(cooldownRef.current);
            if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
            setFlashTexto(null);
        }
    }, [visible]);

    useEffect(() => {
        if (visible && !permission?.granted) {
            requestPermission();
        }
    }, [visible, permission?.granted, requestPermission]);

    // Cuando el padre resuelve el código y nos pasa el label, lo mostramos
    // como flash (modo multi). En single el modal ya se cerró antes.
    useEffect(() => {
        if (mode !== 'multi' || !lastScanFlash || flashKey === undefined) return;
        setFlashTexto(lastScanFlash);
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => setFlashTexto(null), FLASH_MS);
        // Disparamos por flashKey (no por lastScanFlash) para que el flash se
        // re-muestre incluso cuando el texto es idéntico al previo.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flashKey, mode]);

    const handleBarcode = ({ data }: { data: string }) => {
        if (bloqueado) return;
        setBloqueado(true);
        // Feedback inmediato — antes incluso de que el padre resuelva, para
        // que el operador sepa que el escáner "leyó algo".
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        playBeep();

        onScan(data);

        if (mode === 'single') {
            // El padre cerrará el modal con onClose; mantenemos el bloqueo
            // hasta que `visible` cambie y el effect lo resetee.
            return;
        }

        // En multi seguimos abiertos; soltamos el bloqueo después del cooldown.
        if (cooldownRef.current) clearTimeout(cooldownRef.current);
        cooldownRef.current = setTimeout(() => setBloqueado(false), COOLDOWN_MS);
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={{ flex: 1, backgroundColor: '#000' }}>
                {permission?.granted ? (
                    <CameraView
                        style={StyleSheet.absoluteFill}
                        facing="back"
                        onBarcodeScanned={handleBarcode}
                        barcodeScannerSettings={{
                            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'],
                        }}
                    />
                ) : (
                    <View
                        style={{
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: t.space['5'],
                        }}
                    >
                        <Ionicons name="camera-reverse-outline" size={48} color="#fff" />
                        <Text
                            variant="headingLg"
                            style={{ color: '#fff', marginTop: t.space['3'], textAlign: 'center' }}
                        >
                            Sin permiso de cámara
                        </Text>
                        <Text
                            variant="bodyMd"
                            style={{
                                color: 'rgba(255,255,255,0.7)',
                                marginTop: t.space['2'],
                                textAlign: 'center',
                            }}
                        >
                            Habilita el acceso a la cámara desde los ajustes del sistema para
                            escanear códigos.
                        </Text>
                    </View>
                )}

                {/* Toggle Uno/Varios — solo si el padre lo permite. */}
                {onModeChange ? (
                    <View
                        style={{
                            position: 'absolute',
                            top: t.space['7'],
                            alignSelf: 'center',
                            flexDirection: 'row',
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            borderRadius: t.radius.full,
                            padding: 4,
                            gap: 4,
                        }}
                    >
                        <ModeToggle
                            label="Uno"
                            active={mode === 'single'}
                            onPress={() => onModeChange('single')}
                        />
                        <ModeToggle
                            label="Varios"
                            active={mode === 'multi'}
                            onPress={() => onModeChange('multi')}
                        />
                    </View>
                ) : null}

                {/* Marco + label */}
                <View
                    style={{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' }}
                    pointerEvents="none"
                >
                    <View
                        style={{
                            width: 260,
                            height: 260,
                            borderRadius: t.radius.lg,
                            borderWidth: 3,
                            borderColor: t.color.accent.default,
                        }}
                    />
                    <Text
                        variant="label"
                        style={{
                            color: '#fff',
                            marginTop: t.space['5'],
                            letterSpacing: 1.5,
                        }}
                    >
                        {mode === 'multi'
                            ? 'ESCANEA UNO TRAS OTRO'
                            : 'APUNTA AL CÓDIGO DE BARRAS'}
                    </Text>
                </View>

                {/* Flash de confirmación — solo en modo multi */}
                {mode === 'multi' && flashTexto ? (
                    <View
                        pointerEvents="none"
                        style={{
                            position: 'absolute',
                            top: '38%',
                            alignSelf: 'center',
                            backgroundColor: t.color.accent.default,
                            paddingHorizontal: t.space['4'],
                            paddingVertical: t.space['3'],
                            borderRadius: t.radius.md,
                            maxWidth: '85%',
                        }}
                    >
                        <Text variant="bodyMd" emphasized style={{ color: '#fff', textAlign: 'center' }}>
                            {flashTexto}
                        </Text>
                    </View>
                ) : null}

                <View
                    style={{
                        position: 'absolute',
                        bottom: t.space['7'],
                        left: t.space['5'],
                        right: t.space['5'],
                    }}
                >
                    <Button
                        variant="secondary"
                        size="lg"
                        label={mode === 'multi' ? 'Listo' : 'Cerrar'}
                        onPress={onClose}
                        fullWidth
                        leadingIcon={
                            <Ionicons
                                name={mode === 'multi' ? 'checkmark' : 'close'}
                                size={18}
                                color={t.color.fg.primary}
                            />
                        }
                    />
                </View>
            </View>
        </Modal>
    );
}

function ModeToggle({
    label,
    active,
    onPress,
}: {
    label: string;
    active: boolean;
    onPress: () => void;
}) {
    const t = useTheme();
    return (
        <Pressable
            onPress={onPress}
            style={{
                paddingHorizontal: t.space['4'],
                paddingVertical: t.space['2'],
                borderRadius: t.radius.full,
                backgroundColor: active ? t.color.accent.default : 'transparent',
            }}
        >
            <Text variant="label" style={{ color: '#fff', letterSpacing: 1 }}>
                {label}
            </Text>
        </Pressable>
    );
}

// ============== Audio ==============
//
// Cargamos el player perezoso y reusamos la misma instancia para no pagar
// el costo de inicializar audio en cada escaneo. Si `expo-audio` no está
// disponible o el asset no se encuentra, simplemente no suena.

interface BeepPlayer {
    play: () => void;
}

let beepPlayer: BeepPlayer | null = null;
let beepInitTried = false;

async function initBeep(): Promise<void> {
    if (beepInitTried) return;
    beepInitTried = true;
    if (!beepAsset) return;
    try {
        // Import dinámico para no romper el bundle si la dep no está instalada.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const audio = require('expo-audio');
        // expo-audio: createAudioPlayer(source) → AudioPlayer { play, ... }
        const player = audio.createAudioPlayer(beepAsset);
        beepPlayer = {
            play: () => {
                try {
                    player.seekTo(0);
                    player.play();
                } catch {
                    // ignorar
                }
            },
        };
    } catch {
        beepPlayer = null;
    }
}

function playBeep(): void {
    if (beepPlayer) {
        beepPlayer.play();
        return;
    }
    void initBeep().then(() => {
        if (beepPlayer) beepPlayer.play();
    });
}
