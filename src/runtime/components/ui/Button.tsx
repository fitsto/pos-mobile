/**
 * Button — primitivo de acción.
 *
 * Variantes
 *   primary   → fondo accent (naranja), texto blanco. CTA principal.
 *   secondary → fondo raised con borde strong. Acciones secundarias.
 *   ghost     → sin fondo, texto accent. Acción terciaria / inline.
 *   danger    → fondo rojo, para acciones destructivas (anular venta, etc.).
 *
 * Tamaños
 *   sm (36) · md (48, default) · lg (56)
 *
 * A11y
 *   Target táctil mínimo 48 px (md/lg cumplen; sm viene con hitSlop).
 *   Disabled → baja opacidad + no press events.
 *   Loading → spinner, texto oculto pero espacio preservado.
 */
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export type ButtonProps = {
    label: string;
    onPress?: () => void;
    variant?: Variant;
    size?: Size;
    disabled?: boolean;
    loading?: boolean;
    fullWidth?: boolean;
    /** Ícono a la izquierda — elemento React (Ionicons, etc.). */
    leadingIcon?: React.ReactNode;
    /** Ícono a la derecha. */
    trailingIcon?: React.ReactNode;
    style?: ViewStyle;
    testID?: string;
};

export function Button({
    label,
    onPress,
    variant = 'primary',
    size = 'md',
    disabled,
    loading,
    fullWidth,
    leadingIcon,
    trailingIcon,
    style,
    testID,
}: ButtonProps) {
    const t = useTheme();
    const isDisabled = disabled || loading;

    const heights: Record<Size, number> = { sm: 36, md: 48, lg: 56 };
    const paddingH: Record<Size, number> = { sm: t.space['3'], md: t.space['4'], lg: t.space['5'] };
    const textVariant = size === 'lg' ? 'headingMd' : 'bodyLg';

    const getColors = (pressed: boolean) => {
        switch (variant) {
            case 'primary':
                return {
                    bg: pressed ? t.color.accent.pressed : t.color.accent.default,
                    fg: t.color.fg.onAccent,
                    border: 'transparent',
                };
            case 'secondary':
                return {
                    bg: pressed ? t.color.bg.sunken : t.color.bg.raised,
                    fg: t.color.fg.primary,
                    border: t.color.border.strong,
                };
            case 'ghost':
                return {
                    bg: pressed ? t.color.accent.soft : 'transparent',
                    fg: t.color.accent.default,
                    border: 'transparent',
                };
            case 'danger':
                return {
                    bg: pressed ? '#B91C1C' : t.color.feedback.dangerFg,
                    fg: '#FFFFFF',
                    border: 'transparent',
                };
        }
    };

    return (
        <Pressable
            onPress={onPress}
            disabled={isDisabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: isDisabled, busy: loading }}
            accessibilityLabel={label}
            hitSlop={size === 'sm' ? 8 : undefined}
            testID={testID}
            style={({ pressed }) => {
                const c = getColors(pressed);
                return [
                    styles.base,
                    {
                        height: heights[size],
                        paddingHorizontal: paddingH[size],
                        backgroundColor: c.bg,
                        borderColor: c.border,
                        borderWidth: variant === 'secondary' ? t.border.strong : 0,
                        borderRadius: t.radius.md,
                        opacity: isDisabled && !loading ? 0.4 : 1,
                        width: fullWidth ? '100%' : undefined,
                    },
                    style,
                ];
            }}
        >
            {({ pressed }) => {
                const c = getColors(pressed);
                return (
                    <View style={styles.row}>
                        {loading ? (
                            <ActivityIndicator size="small" color={c.fg} />
                        ) : (
                            <>
                                {leadingIcon ? <View style={{ marginRight: t.space['2'] }}>{leadingIcon}</View> : null}
                                <Text
                                    variant={textVariant}
                                    emphasized
                                    style={{ color: c.fg }}
                                    numberOfLines={1}
                                >
                                    {label}
                                </Text>
                                {trailingIcon ? <View style={{ marginLeft: t.space['2'] }}>{trailingIcon}</View> : null}
                            </>
                        )}
                    </View>
                );
            }}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    base: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
