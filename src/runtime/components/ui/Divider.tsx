import { View, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export function Divider({ spacing = 0, style }: { spacing?: number; style?: ViewStyle }) {
    const t = useTheme();
    return (
        <View
            style={[
                {
                    height: t.border.default,
                    backgroundColor: t.color.border.subtle,
                    marginVertical: spacing,
                },
                style,
            ]}
        />
    );
}
