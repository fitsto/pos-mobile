/**
 * Sheet — modal de fondo para flujos de decisión (cobro, selector variante,
 * registro cliente, confirmaciones).
 *
 * Dos layouts:
 *   bottom (default) → sube desde abajo, ocupa lo necesario, respeta safe-area.
 *   center           → centrado con margen — para diálogos cortos.
 *
 * Uso:
 *   <Sheet visible={v} onClose={fn} title="Cobrar">
 *     <Text>...</Text>
 *   </Sheet>
 */
import { Modal, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

export type SheetProps = {
    visible: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: string;
    position?: 'bottom' | 'center';
    /** Si true, muestra el handle bar (grip) arriba. Default: sólo en bottom. */
    withHandle?: boolean;
    /** Permite cerrar tocando el backdrop. Default: true. */
    dismissOnBackdrop?: boolean;
    /** Contenido. Scroll debe manejarse adentro si es largo. */
    children: React.ReactNode;
    /** Acciones en el footer (botones). Se colocan al fondo con separador. */
    footer?: React.ReactNode;
    contentStyle?: ViewStyle;
};

export function Sheet({
    visible,
    onClose,
    title,
    subtitle,
    position = 'bottom',
    withHandle,
    dismissOnBackdrop = true,
    children,
    footer,
    contentStyle,
}: SheetProps) {
    const t = useTheme();

    const showHandle = withHandle ?? position === 'bottom';
    const radiusTop = position === 'bottom' ? t.radius.xl : t.radius.lg;
    const radiusBottom = position === 'bottom' ? 0 : t.radius.lg;

    return (
        <Modal
            visible={visible}
            transparent
            animationType={position === 'bottom' ? 'slide' : 'fade'}
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <Pressable
                onPress={dismissOnBackdrop ? onClose : undefined}
                style={[
                    styles.backdrop,
                    {
                        backgroundColor: t.color.overlay,
                        justifyContent: position === 'bottom' ? 'flex-end' : 'center',
                        paddingHorizontal: position === 'center' ? t.space['4'] : 0,
                    },
                ]}
            >
                {/* inner Pressable bloquea propagación del tap para no cerrar al tocar contenido */}
                <Pressable onPress={() => undefined} style={{ width: '100%' }}>
                    <SafeAreaView
                        edges={position === 'bottom' ? ['bottom'] : []}
                        style={{
                            backgroundColor: t.color.bg.raised,
                            borderTopLeftRadius: radiusTop,
                            borderTopRightRadius: radiusTop,
                            borderBottomLeftRadius: radiusBottom,
                            borderBottomRightRadius: radiusBottom,
                            overflow: 'hidden',
                        }}
                    >
                        {showHandle ? (
                            <View style={styles.handleWrap}>
                                <View
                                    style={{
                                        width: 40,
                                        height: 4,
                                        borderRadius: 2,
                                        backgroundColor: t.color.border.default,
                                    }}
                                />
                            </View>
                        ) : null}
                        {title ? (
                            <View
                                style={{
                                    paddingHorizontal: t.space['5'],
                                    paddingTop: showHandle ? t.space['2'] : t.space['5'],
                                    paddingBottom: t.space['3'],
                                }}
                            >
                                <Text variant="displayMd">{title}</Text>
                                {subtitle ? (
                                    <Text variant="bodyMd" tone="secondary" style={{ marginTop: 4 }}>
                                        {subtitle}
                                    </Text>
                                ) : null}
                            </View>
                        ) : null}
                        <View
                            style={[
                                {
                                    paddingHorizontal: t.space['5'],
                                    paddingVertical: title ? t.space['2'] : t.space['5'],
                                },
                                contentStyle,
                            ]}
                        >
                            {children}
                        </View>
                        {footer ? (
                            <View
                                style={{
                                    paddingHorizontal: t.space['5'],
                                    paddingTop: t.space['3'],
                                    paddingBottom: t.space['4'],
                                    borderTopWidth: t.border.default,
                                    borderTopColor: t.color.border.subtle,
                                }}
                            >
                                {footer}
                            </View>
                        ) : null}
                    </SafeAreaView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
    },
    handleWrap: {
        alignItems: 'center',
        paddingTop: 8,
        paddingBottom: 4,
    },
});
