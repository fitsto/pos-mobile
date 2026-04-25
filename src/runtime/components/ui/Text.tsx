/**
 * Text — primitivo tipográfico.
 *
 * Resuelve la familia de fuente concreta (archivo expo-font) a partir de un
 * `variant` semántico. No usar `fontWeight` como prop: con fuentes custom de
 * expo-font cada peso es un archivo distinto; el mapeo vive acá.
 *
 * Uso:
 *   <Text variant="displayLg">Nuevo producto</Text>
 *   <Text variant="monoMd" tone="secondary">SKU-123</Text>
 *   <Text variant="bodyMd" tone="danger">Sin stock</Text>
 */
import { Text as RNText, StyleSheet, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export type TextVariant =
    | 'displayXl'
    | 'displayLg'
    | 'displayMd'
    | 'headingLg'
    | 'headingMd'
    | 'headingSm'
    | 'bodyLg'
    | 'bodyMd'
    | 'bodySm'
    | 'monoLg'
    | 'monoMd'
    | 'monoSm'
    | 'label';

type Tone = 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'accent' | 'success' | 'warning' | 'danger';

/**
 * Map variant → archivo de fuente concreto cargado en _layout.
 * expo-font no compone fontWeight con custom fonts: hay que nombrar el archivo.
 */
const fontByVariant: Record<TextVariant, string> = {
    displayXl: 'BricolageGrotesque-Bold',
    displayLg: 'BricolageGrotesque-Bold',
    displayMd: 'BricolageGrotesque-Bold',
    headingLg: 'IBMPlexSans-SemiBold',
    headingMd: 'IBMPlexSans-SemiBold',
    headingSm: 'IBMPlexSans-SemiBold',
    bodyLg: 'IBMPlexSans',
    bodyMd: 'IBMPlexSans',
    bodySm: 'IBMPlexSans',
    monoLg: 'IBMPlexMono-Medium',
    monoMd: 'IBMPlexMono',
    monoSm: 'IBMPlexMono',
    label: 'IBMPlexSans-SemiBold',
};

export type TextProps = RNTextProps & {
    variant?: TextVariant;
    tone?: Tone;
    /** Aplica numeric tabular (sólo útil en fuentes mono). */
    tabular?: boolean;
    /** Fuerza negrita en body — usa la semibold de IBM Plex. */
    emphasized?: boolean;
    align?: 'left' | 'center' | 'right';
};

export function Text({
    variant = 'bodyMd',
    tone = 'primary',
    tabular,
    emphasized,
    align,
    style,
    children,
    ...rest
}: TextProps) {
    const t = useTheme();
    // Fallback a bodyMd si llega un variant desconocido — evita crashes en runtime
    // mientras migramos pantallas. En dev loggeamos para detectar el caso.
    const base = t.type[variant] ?? t.type.bodyMd;
    if (__DEV__ && !t.type[variant]) {
        // eslint-disable-next-line no-console
        console.warn(`[Text] variant desconocido: "${variant}" — usando bodyMd`);
    }

    const toneColor: Record<Tone, string> = {
        primary: t.color.fg.primary,
        secondary: t.color.fg.secondary,
        tertiary: t.color.fg.tertiary,
        inverse: t.color.fg.inverse,
        accent: t.color.accent.default,
        success: t.color.feedback.successFg,
        warning: t.color.feedback.warningFg,
        danger: t.color.feedback.dangerFg,
    };

    const family =
        emphasized && variant.startsWith('body') ? 'IBMPlexSans-SemiBold' : fontByVariant[variant];

    const composed: TextStyle = {
        fontFamily: family,
        fontSize: base.fontSize,
        lineHeight: base.lineHeight,
        letterSpacing: base.letterSpacing,
        textTransform: base.textTransform,
        color: toneColor[tone],
        textAlign: align,
        fontVariant: tabular ? ['tabular-nums'] : undefined,
    };

    return (
        <RNText allowFontScaling style={StyleSheet.flatten([composed, style])} {...rest}>
            {children}
        </RNText>
    );
}
