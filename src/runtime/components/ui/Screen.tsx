/**
 * Screen — contenedor raíz de cada pantalla.
 *
 * Aplica safe-area, fondo `canvas`, keyboard dismiss al tap, padding horizontal
 * consistente. Header opcional (título grande tipo iOS 15+ settings).
 *
 * Evita que cada pantalla repita SafeAreaView + KeyboardAvoidingView + paddings.
 */
import { Ionicons } from '@expo/vector-icons';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    View,
    type ScrollViewProps,
    type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

export type ScreenProps = {
    /** Si scrollable, wrappea en ScrollView. Default: false. */
    scroll?: boolean;
    /** Título grande al tope (estilo Settings). Omitir para usar header del Stack. */
    title?: string;
    subtitle?: string;
    /** Padding horizontal. Default: 4 (16). Pasar 0 para bleed de listas. */
    paddingH?: 0 | 2 | 3 | 4 | 5;
    /** KeyboardAvoidingView. Default: true. */
    keyboardAvoiding?: boolean;
    /** Safe area edges. Default: ['top','bottom']. */
    edges?: Array<'top' | 'right' | 'bottom' | 'left'>;
    style?: ViewStyle;
    contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
    children: React.ReactNode;
    /** Slot para sticky bottom (botón primario, barra de total). */
    footer?: React.ReactNode;
    /** Si se pasa, renderiza un botón "Atrás" sobre el título. Útil para sub-estados dentro de un tab. */
    onBack?: () => void;
    /** Etiqueta opcional del botón atrás. Default: "Atrás". */
    backLabel?: string;
    testID?: string;
};

export function Screen({
    scroll = false,
    title,
    subtitle,
    paddingH = 4,
    keyboardAvoiding = true,
    edges = ['top', 'bottom'],
    style,
    contentContainerStyle,
    children,
    footer,
    onBack,
    backLabel = 'Atrás',
    testID,
}: ScreenProps) {
    const t = useTheme();
    const padH = paddingH === 0 ? 0 : t.space[String(paddingH) as keyof typeof t.space];

    const headerInnerPad = padH || t.space['4'];
    const backBlock = onBack ? (
        <Pressable
            onPress={onBack}
            hitSlop={8}
            style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                alignSelf: 'flex-start',
                gap: 4,
                paddingVertical: t.space['1'],
                paddingRight: t.space['2'],
                opacity: pressed ? 0.6 : 1,
            })}
        >
            <Ionicons name="chevron-back" size={18} color={t.color.fg.secondary} />
            <Text variant="label" tone="secondary">{backLabel}</Text>
        </Pressable>
    ) : null;

    const titleBlock = title || onBack ? (
        <View style={{ paddingHorizontal: headerInnerPad, paddingTop: t.space['2'], paddingBottom: t.space['4'] }}>
            {backBlock}
            {title ? <Text variant="displayLg" style={onBack ? { marginTop: t.space['2'] } : undefined}>{title}</Text> : null}
            {subtitle ? (
                <Text variant="bodyMd" tone="secondary" style={{ marginTop: 4 }}>
                    {subtitle}
                </Text>
            ) : null}
        </View>
    ) : null;

    const body = scroll ? (
        <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
            contentContainerStyle={[{ paddingHorizontal: padH, paddingBottom: t.space['6'] }, contentContainerStyle]}
        >
            {titleBlock}
            {children}
        </ScrollView>
    ) : (
        <View style={[{ flex: 1, paddingHorizontal: padH }, style]}>
            {titleBlock}
            {children}
        </View>
    );

    const inner = (
        <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: t.color.bg.canvas }} testID={testID}>
            {body}
            {footer ? (
                <View
                    style={{
                        paddingHorizontal: t.space['4'],
                        paddingTop: t.space['3'],
                        paddingBottom: t.space['4'],
                        borderTopWidth: t.border.default,
                        borderTopColor: t.color.border.subtle,
                        backgroundColor: t.color.bg.raised,
                    }}
                >
                    {footer}
                </View>
            ) : null}
        </SafeAreaView>
    );

    if (!keyboardAvoiding) return inner;

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            {inner}
        </KeyboardAvoidingView>
    );
}
