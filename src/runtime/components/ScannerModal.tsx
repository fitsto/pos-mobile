import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, radius, spacing, type } from '../theme/tokens';

interface Props {
  visible: boolean;
  onClose: () => void;
  onScan: (codigo: string) => void;
}

export function ScannerModal({ visible, onClose, onScan }: Props) {
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
      <View style={styles.root}>
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
          <View style={styles.denied}>
            <Text style={styles.deniedTitle}>Sin permiso de cámara</Text>
            <Text style={styles.deniedBody}>
              Habilita el acceso a la cámara desde los ajustes del sistema para escanear códigos.
            </Text>
          </View>
        )}

        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.frame} />
          <Text style={styles.hint}>Apunta al código de barras</Text>
        </View>

        <Pressable style={styles.close} onPress={onClose}>
          <Text style={styles.closeText}>Cerrar</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: 260,
    height: 260,
    borderRadius: radius.lg,
    borderWidth: 3,
    borderColor: colors.accent,
  },
  hint: { color: colors.text, marginTop: spacing.lg, ...type.label },
  close: {
    position: 'absolute',
    bottom: spacing.xxl,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeText: { color: colors.text, ...type.label },
  denied: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  deniedTitle: { ...type.title, color: colors.text, marginBottom: spacing.md },
  deniedBody: { ...type.body, color: colors.textMuted, textAlign: 'center' },
});
