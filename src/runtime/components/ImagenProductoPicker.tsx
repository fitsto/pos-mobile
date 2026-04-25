/**
 * ImagenProductoPicker — imagen principal del producto con acciones de subir.
 *
 * Muestra la imagen actual (o un placeholder si no hay) y un ActionSheet
 * mínimo con las opciones "Tomar foto" / "Elegir de galería".
 *
 * La lógica de signed-url + PUT + confirmar vive en
 * `SubirImagenProductoUseCase`; acá sólo disparamos el picker, comprimimos
 * un poco y delegamos.
 */
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import { container } from '../di/container';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './ui';

interface Props {
    negocioId: string;
    productoId: string;
    token: string;
    imagenUrl: string | null;
    onUploaded: (nuevaUrl: string | null) => void;
    editable: boolean;
}

export function ImagenProductoPicker({
    negocioId,
    productoId,
    token,
    imagenUrl,
    onUploaded,
    editable,
}: Props) {
    const t = useTheme();
    const [subiendo, setSubiendo] = useState(false);
    const hayImagen = !!imagenUrl && imagenUrl.trim().length > 0;

    const subir = async (source: 'camera' | 'library') => {
        try {
            if (source === 'camera') {
                const perm = await ImagePicker.requestCameraPermissionsAsync();
                if (!perm.granted) {
                    Alert.alert('Sin permiso', 'Debes habilitar la cámara desde los ajustes.');
                    return;
                }
            } else {
                const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (!perm.granted) {
                    Alert.alert('Sin permiso', 'Debes habilitar el acceso a fotos desde los ajustes.');
                    return;
                }
            }

            const result =
                source === 'camera'
                    ? await ImagePicker.launchCameraAsync({
                          mediaTypes: ImagePicker.MediaTypeOptions.Images,
                          quality: 0.7,
                          allowsEditing: true,
                          aspect: [1, 1],
                      })
                    : await ImagePicker.launchImageLibraryAsync({
                          mediaTypes: ImagePicker.MediaTypeOptions.Images,
                          quality: 0.7,
                          allowsEditing: true,
                          aspect: [1, 1],
                      });

            if (result.canceled) return;
            const asset = result.assets[0];
            if (!asset?.uri) return;

            setSubiendo(true);
            const actualizado = await container.subirImagenProducto.execute({
                negocioId,
                productoId,
                token,
                localUri: asset.uri,
                contentType: asset.mimeType ?? 'image/jpeg',
            });
            onUploaded(actualizado.imagenUrl);
        } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo subir la imagen');
        } finally {
            setSubiendo(false);
        }
    };

    const elegir = () => {
        if (!editable) return;
        Alert.alert(
            hayImagen ? 'Cambiar foto' : 'Agregar foto',
            '¿Desde dónde la obtienes?',
            [
                { text: 'Tomar foto', onPress: () => subir('camera') },
                { text: 'Elegir de galería', onPress: () => subir('library') },
                { text: 'Cancelar', style: 'cancel' },
            ],
        );
    };

    return (
        <Pressable
            onPress={elegir}
            disabled={!editable || subiendo}
            style={({ pressed }) => ({
                alignSelf: 'center',
                width: 180,
                height: 180,
                borderRadius: t.radius.lg,
                borderWidth: t.border.default,
                borderColor: t.color.border.subtle,
                backgroundColor: pressed ? t.color.bg.sunken : t.color.bg.raised,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: subiendo ? 0.5 : 1,
            })}
        >
            {hayImagen ? (
                <>
                    <Image
                        source={{ uri: imagenUrl as string }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                    />
                    {editable ? (
                        <View
                            style={{
                                position: 'absolute',
                                bottom: 8,
                                right: 8,
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                backgroundColor: t.color.accent.default,
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Ionicons name="camera" size={18} color={t.color.fg.onAccent} />
                        </View>
                    ) : null}
                </>
            ) : (
                <View
                    style={{
                        flex: 1,
                        width: '100%',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: t.color.bg.sunken,
                        padding: t.space['3'],
                    }}
                >
                    <Ionicons
                        name="cube-outline"
                        size={72}
                        color={t.color.fg.tertiary}
                    />
                    <Text
                        variant="bodySm"
                        tone="tertiary"
                        align="center"
                        style={{ marginTop: t.space['2'] }}
                    >
                        Sin foto
                    </Text>
                    {editable ? (
                        <View
                            style={{
                                position: 'absolute',
                                bottom: 8,
                                right: 8,
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                backgroundColor: t.color.accent.default,
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Ionicons name="camera" size={18} color={t.color.fg.onAccent} />
                        </View>
                    ) : null}
                </View>
            )}
        </Pressable>
    );
}
