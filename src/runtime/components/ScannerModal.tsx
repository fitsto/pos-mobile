/**
 * Modal de escaneo de códigos de barras.
 * Fullscreen con cámara, marco naranja y botón cerrar.
 */
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Button, Text } from './ui';

interface Props {
    visible: boolean;
    onClose: () => void;
    onScan: (codigo: string) => void;
}

export function ScannerModal({ visible, onClose, onScan }: Props) {
    const t = useTheme();
    const [permission, requestPermission] = useCameraPermissions();
    const [bloqueado, setBloqueado] = useState(false);

    useEffect(() => {
        if (visible) setBloqueado(false);
    }, [visible]);

    useEffect(() => {
        if (visible && !permission?.granted) {
            requestPermission();
        }
    }, [visible, permission?.granted, requestPermission]);

    const handleBarcode = ({ data }: { data: string }) => {
        if (bloqueado) return;
        setBloqueado(true);
        onScan(data);
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
                        APUNTA AL CÓDIGO DE BARRAS
                    </Text>
                </View>

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
                        label="Cerrar"
                        onPress={onClose}
                        fullWidth
                        leadingIcon={<Ionicons name="close" size={18} color={t.color.fg.primary} />}
                    />
                </View>
            </View>
        </Modal>
    );
}
