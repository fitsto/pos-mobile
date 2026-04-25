/**
 * Chip — pequeña píldora para filtros, tags, selecciones.
 *
 * Estados
 *   default   → borde subtle, bg raised, fg secondary
 *   selected  → bg inverse, fg inverse (contraste fuerte — como Material 3)
 *   accent    → bg accent.soft, fg accent.onSoft
 */
import { Pressable, View, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

export type ChipProps = {
    label: string;
    selected?: boolean;
    tone?: 'default' | 'accent' | 'success' | 'warning' | 'danger';
    onPress?: () => void;
    disabled?: boolean;
    leadingIcon?: React.ReactNode;
    style?: ViewStyle;
    testID?: string;
};

export function Chip({ label, selected, tone = 'default', onPress, disabled, leadingIcon, style, testID }: ChipProps) {
    const t = useTheme();

    let bg: string;
    let fg: 'primary' | 'secondary' | 'inverse' | 'accent' | 'success' | 'warning' | 'danger';
    let borderColor: string;

    if (selected) {
        bg = t.color.bg.inverse;
        fg = 'inverse';
        borderColor = t.color.bg.inverse;
    } else {
        switch (tone) {
            case 'accent':
                bg = t.color.accent.soft;
                fg = 'accent';
                borderColor = t.color.accent.soft;
                break;
            case 'success':
                bg = t.color.feedback.successBg;
                fg = 'success';
                borderColor = t.color.feedback.successBg;
                break;
            case 'warning':
                bg = t.color.feedback.warningBg;
                fg = 'warning';
                borderColor = t.color.feedback.warningBg;
                break;
            case 'danger':
                bg = t.color.feedback.dangerBg;
                fg = 'danger';
                borderColor = t.color.feedback.dangerBg;
                break;
            default:
                bg = t.color.bg.raised;
                fg = 'secondary';
                borderColor = t.color.border.subtle;
        }
    }

    const content = (
        <View
            style={[
                {
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: t.space['3'],
                    paddingVertical: 6,
                    borderRadius: t.radius.full,
                    backgroundColor: bg,
                    borderWidth: t.border.default,
                    borderColor,
                    alignSelf: 'flex-start',
                },
                style,
            ]}
        >
            {leadingIcon ? <View style={{ marginRight: t.space['1'] }}>{leadingIcon}</View> : null}
            <Text variant="bodySm" tone={fg} emphasized>
                {label}
            </Text>
        </View>
    );

    if (!onPress) return content;

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: !!selected, disabled: !!disabled }}
            testID={testID}
            hitSlop={4}
            style={disabled ? { opacity: 0.4 } : undefined}
        >
            {content}
        </Pressable>
    );
}
