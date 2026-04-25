/**
 * TextField — input de texto con label, helper, error y slots de íconos.
 *
 * Estados
 *   default  → borde subtle, bg sunken
 *   focused  → borde strong (2 px)
 *   error    → borde danger + helper danger
 *   disabled → opacidad baja, sin interacción
 *
 * Variantes
 *   text  (default) · numeric · mono (para SKU, códigos)
 */
import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
    label?: string;
    helper?: string;
    error?: string;
    /** Usa IBMPlexMono. Útil para SKU, códigos, cantidades. */
    mono?: boolean;
    leadingIcon?: React.ReactNode;
    trailingIcon?: React.ReactNode;
    /** Handler para tap en el trailing icon (botón limpiar, ojo password, etc.). */
    onTrailingPress?: () => void;
    required?: boolean;
    style?: ViewStyle;
    inputStyle?: TextInputProps['style'];
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
    { label, helper, error, mono, leadingIcon, trailingIcon, onTrailingPress, required, style, inputStyle, onFocus, onBlur, editable = true, ...rest },
    ref,
) {
    const t = useTheme();
    const [focused, setFocused] = useState(false);

    const borderColor = error
        ? t.color.feedback.dangerFg
        : focused
            ? t.color.border.strong
            : t.color.border.default;

    const helperTone = error ? 'danger' : 'tertiary';
    const helperText = error || helper;

    return (
        <View style={style}>
            {label ? (
                <View style={{ marginBottom: t.space['2'], flexDirection: 'row' }}>
                    <Text variant="label" tone="secondary">
                        {label}
                    </Text>
                    {required ? (
                        <Text variant="label" tone="danger" style={{ marginLeft: 4 }}>
                            *
                        </Text>
                    ) : null}
                </View>
            ) : null}
            <View
                style={[
                    styles.wrap,
                    {
                        backgroundColor: t.color.bg.sunken,
                        borderColor,
                        borderRadius: t.radius.md,
                        borderWidth: focused || error ? t.border.strong : t.border.default,
                        opacity: editable ? 1 : 0.5,
                        paddingHorizontal: t.space['3'],
                    },
                ]}
            >
                {leadingIcon ? <View style={{ marginRight: t.space['2'] }}>{leadingIcon}</View> : null}
                <TextInput
                    ref={ref}
                    editable={editable}
                    placeholderTextColor={t.color.fg.tertiary}
                    selectionColor={t.color.accent.default}
                    onFocus={(e) => {
                        setFocused(true);
                        onFocus?.(e);
                    }}
                    onBlur={(e) => {
                        setFocused(false);
                        onBlur?.(e);
                    }}
                    style={[
                        styles.input,
                        {
                            color: t.color.fg.primary,
                            fontFamily: mono ? t.font.mono : t.font.body,
                            fontSize: mono ? 15 : 16,
                            lineHeight: mono ? 20 : 22,
                        },
                        inputStyle,
                    ]}
                    {...rest}
                />
                {trailingIcon ? (
                    onTrailingPress ? (
                        <Pressable
                            onPress={onTrailingPress}
                            hitSlop={8}
                            style={{ marginLeft: t.space['2'], padding: 4 }}
                        >
                            {trailingIcon}
                        </Pressable>
                    ) : (
                        <View style={{ marginLeft: t.space['2'] }}>{trailingIcon}</View>
                    )
                ) : null}
            </View>
            {helperText ? (
                <Text variant="bodySm" tone={helperTone} style={{ marginTop: t.space['1'] }}>
                    {helperText}
                </Text>
            ) : null}
        </View>
    );
});

const styles = StyleSheet.create({
    wrap: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 48,
    },
    input: {
        flex: 1,
        paddingVertical: 12,
    },
});
