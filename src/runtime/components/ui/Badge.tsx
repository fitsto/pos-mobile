/**
 * Badge — indicador de estado compacto. Sin interacción.
 *
 * Uso: "Sin stock", "Vencido", "Pendiente de sync", "3" (contador).
 */
import { View, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

export type BadgeProps = {
    label: string | number;
    tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
    /** Sólido vs suave. Default: soft. */
    variant?: 'solid' | 'soft';
    style?: ViewStyle;
};

export function Badge({ label, tone = 'neutral', variant = 'soft', style }: BadgeProps) {
    const t = useTheme();

    let bg: string;
    let fg: 'primary' | 'inverse' | 'accent' | 'success' | 'warning' | 'danger';

    if (variant === 'solid') {
        switch (tone) {
            case 'accent':
                bg = t.color.accent.default;
                fg = 'inverse';
                break;
            case 'success':
                bg = t.color.feedback.successFg;
                fg = 'inverse';
                break;
            case 'warning':
                bg = t.color.feedback.warningFg;
                fg = 'inverse';
                break;
            case 'danger':
                bg = t.color.feedback.dangerFg;
                fg = 'inverse';
                break;
            default:
                bg = t.color.fg.primary;
                fg = 'inverse';
        }
    } else {
        switch (tone) {
            case 'accent':
                bg = t.color.accent.soft;
                fg = 'accent';
                break;
            case 'success':
                bg = t.color.feedback.successBg;
                fg = 'success';
                break;
            case 'warning':
                bg = t.color.feedback.warningBg;
                fg = 'warning';
                break;
            case 'danger':
                bg = t.color.feedback.dangerBg;
                fg = 'danger';
                break;
            default:
                bg = t.color.bg.sunken;
                fg = 'primary';
        }
    }

    return (
        <View
            style={[
                {
                    paddingHorizontal: t.space['2'],
                    paddingVertical: 2,
                    borderRadius: t.radius.xs,
                    backgroundColor: bg,
                    alignSelf: 'flex-start',
                },
                style,
            ]}
        >
            <Text variant="label" tone={fg} style={{ letterSpacing: 0.8 }}>
                {String(label)}
            </Text>
        </View>
    );
}
