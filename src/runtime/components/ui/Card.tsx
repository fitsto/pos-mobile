/**
 * Card — contenedor elevado o sutil.
 *
 * Variantes
 *   raised  → fondo raised, sin borde, con sombra muy sutil (default en dark: solo bg)
 *   subtle  → fondo sunken, sin borde ni sombra — para contenedores interiores
 *   outline → fondo raised + borde subtle — alternativa a sombra, útil en listas
 */
import { View, type ViewProps } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export type CardProps = ViewProps & {
    variant?: 'raised' | 'subtle' | 'outline';
    padding?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    /** Radios mayores (por ej. hero cards). Default: lg (12). */
    radius?: 'md' | 'lg' | 'xl';
};

export function Card({ variant = 'raised', padding = 4, radius = 'lg', style, children, ...rest }: CardProps) {
    const t = useTheme();

    const background =
        variant === 'subtle' ? t.color.bg.sunken : t.color.bg.raised;
    const borderWidth = variant === 'outline' ? t.border.default : 0;
    const borderColor = variant === 'outline' ? t.color.border.subtle : 'transparent';
    const elevation = variant === 'raised' && t.mode === 'light' ? t.shadow.sm : t.shadow.none;

    return (
        <View
            style={[
                {
                    backgroundColor: background,
                    borderRadius: t.radius[radius],
                    padding: t.space[String(padding) as keyof typeof t.space],
                    borderWidth,
                    borderColor,
                    ...elevation,
                },
                style,
            ]}
            {...rest}
        >
            {children}
        </View>
    );
}
