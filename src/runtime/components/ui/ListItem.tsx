/**
 * ListItem — fila tocable de lista. Uso típico: productos, ventas, ubicaciones.
 *
 * Layout:
 *   [leading]  title            [trailing]
 *              subtitle / meta
 *
 * Comportamiento
 *   - Target táctil mínimo 64 px (cómodo para POS con dedo).
 *   - Pressed feedback: bg.sunken.
 *   - divider opcional abajo.
 */
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

export type ListItemProps = {
    title: string;
    subtitle?: string;
    meta?: string;
    leading?: React.ReactNode;
    trailing?: React.ReactNode;
    onPress?: () => void;
    disabled?: boolean;
    divider?: boolean;
    selected?: boolean;
    style?: ViewStyle;
    testID?: string;
};

export function ListItem({
    title,
    subtitle,
    meta,
    leading,
    trailing,
    onPress,
    disabled,
    divider,
    selected,
    style,
    testID,
}: ListItemProps) {
    const t = useTheme();

    const renderContent = (pressed: boolean) => (
        <View
            style={[
                styles.row,
                {
                    paddingHorizontal: t.space['4'],
                    paddingVertical: t.space['3'],
                    minHeight: 64,
                    backgroundColor: pressed
                        ? t.color.bg.sunken
                        : selected
                            ? t.color.accent.soft
                            : 'transparent',
                    borderBottomWidth: divider ? t.border.default : 0,
                    borderBottomColor: t.color.border.subtle,
                    opacity: disabled ? 0.4 : 1,
                },
                style,
            ]}
        >
            {leading ? <View style={{ marginRight: t.space['3'] }}>{leading}</View> : null}
            <View style={{ flex: 1, gap: 2 }}>
                <Text variant="headingSm" numberOfLines={1}>
                    {title}
                </Text>
                {subtitle ? (
                    <Text variant="bodySm" tone="secondary" numberOfLines={1}>
                        {subtitle}
                    </Text>
                ) : null}
                {meta ? (
                    <Text variant="monoSm" tone="tertiary" numberOfLines={1}>
                        {meta}
                    </Text>
                ) : null}
            </View>
            {trailing ? <View style={{ marginLeft: t.space['3'] }}>{trailing}</View> : null}
        </View>
    );

    if (!onPress) {
        return renderContent(false);
    }

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!disabled, selected: !!selected }}
            testID={testID}
        >
            {({ pressed }) => renderContent(pressed)}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});
