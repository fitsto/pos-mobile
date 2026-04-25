/**
 * IconButton — botón cuadrado con un solo ícono.
 *
 * Tamaños: sm (36) · md (44, default — mínimo táctil con hitSlop) · lg (48).
 * Variantes: ghost (default), solid, outline.
 */
import { Pressable, View, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export type IconButtonProps = {
    icon: React.ReactNode;
    onPress: () => void;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'ghost' | 'solid' | 'outline';
    disabled?: boolean;
    accessibilityLabel: string;
    style?: ViewStyle;
    testID?: string;
};

export function IconButton({
    icon,
    onPress,
    size = 'md',
    variant = 'ghost',
    disabled,
    accessibilityLabel,
    style,
    testID,
}: IconButtonProps) {
    const t = useTheme();
    const dims = { sm: 36, md: 44, lg: 48 }[size];

    const getBg = (pressed: boolean) => {
        if (variant === 'solid') {
            return pressed ? t.color.accent.pressed : t.color.accent.default;
        }
        if (variant === 'outline') {
            return pressed ? t.color.bg.sunken : 'transparent';
        }
        return pressed ? t.color.bg.sunken : 'transparent';
    };

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ disabled: !!disabled }}
            hitSlop={4}
            testID={testID}
            style={({ pressed }) => [
                {
                    width: dims,
                    height: dims,
                    borderRadius: t.radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: getBg(pressed),
                    borderWidth: variant === 'outline' ? t.border.default : 0,
                    borderColor: variant === 'outline' ? t.color.border.default : 'transparent',
                    opacity: disabled ? 0.4 : 1,
                },
                style,
            ]}
        >
            <View pointerEvents="none">{icon}</View>
        </Pressable>
    );
}
