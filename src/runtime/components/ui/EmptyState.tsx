/**
 * EmptyState — estado vacío amigable. Uso: lista vacía, sin resultados, sin conexión.
 */
import { View, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from './Button';
import { Text } from './Text';

export type EmptyStateProps = {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
    style?: ViewStyle;
};

export function EmptyState({ icon, title, description, actionLabel, onAction, style }: EmptyStateProps) {
    const t = useTheme();
    return (
        <View
            style={[
                {
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: t.space['6'],
                    paddingVertical: t.space['10'],
                    gap: t.space['3'],
                },
                style,
            ]}
        >
            {icon ? <View style={{ marginBottom: t.space['2'] }}>{icon}</View> : null}
            <Text variant="headingLg" align="center">
                {title}
            </Text>
            {description ? (
                <Text variant="bodyMd" tone="secondary" align="center">
                    {description}
                </Text>
            ) : null}
            {actionLabel && onAction ? (
                <Button label={actionLabel} onPress={onAction} style={{ marginTop: t.space['2'] }} />
            ) : null}
        </View>
    );
}
