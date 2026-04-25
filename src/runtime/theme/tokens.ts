/**
 * Design tokens — dirección "Retail preciso" (Swiss-industrial + acento único).
 *
 * Principios
 * - Monocromo dominante + un solo color de acento (naranja señalético) para CTAs,
 *   foco y alertas positivas.
 * - Tipografía con carácter: display "Bricolage Grotesque", body "IBM Plex Sans",
 *   números/códigos en "IBM Plex Mono" (detalle de identidad en precios y SKUs).
 * - Legibilidad brutal: contraste alto, jerarquía por peso/tamaño, no por color.
 * - Motion cortante, 120–280 ms, sin rebotes. Nada de "juguetón".
 * - Espaciado base 4 px. Targets táctiles ≥ 48 px.
 *
 * Uso
 *   const t = useTheme();                // resuelve light|dark según colorScheme
 *   <View style={{ backgroundColor: t.color.bg.canvas }}>
 *
 * No importar `palette` directo en componentes — usar siempre `t.color.*` semántico.
 */

// ---------------------------------------------------------------------------
// Paleta cruda (no usar en componentes — sólo referencia)
// ---------------------------------------------------------------------------
const palette = {
    // Escala neutra — base del monocromo
    stone: {
        0: '#FFFFFF',
        50: '#FAFAF9',
        100: '#F4F4F3',
        200: '#E7E5E4',
        300: '#D6D3D1',
        400: '#A8A29E',
        500: '#78716C',
        600: '#57534E',
        700: '#44403C',
        800: '#292524',
        900: '#141414',
        950: '#0A0A0A',
        1000: '#000000',
    },
    // Acento único — naranja señalético
    orange: {
        50: '#FFF4ED',
        100: '#FFEDE3',
        200: '#FFD5B8',
        300: '#FFB583',
        400: '#FF8A4C',
        500: '#FF6B33',
        600: '#FF5C1F', // acento principal light
        700: '#E5501A',
        800: '#CC4517',
        900: '#8A2E0F',
    },
    // Semánticos — usados con mesura, sólo cuando la etiqueta del color importa
    green: { 500: '#15803D', 100: '#DCFCE7', 900: '#052E16' },
    amber: { 500: '#D97706', 100: '#FEF3C7', 900: '#451A03' },
    red: { 500: '#DC2626', 100: '#FEE2E2', 900: '#450A0A' },
} as const;

// ---------------------------------------------------------------------------
// Tema semántico
// ---------------------------------------------------------------------------
type ColorTokens = {
    bg: {
        canvas: string; // fondo principal de la app
        raised: string; // cards, sheets, menús
        sunken: string; // inputs, chips, áreas hundidas
        inverse: string; // fondo de elementos invertidos
    };
    fg: {
        primary: string; // títulos, labels importantes
        secondary: string; // body
        tertiary: string; // helpers, muted, placeholders
        inverse: string; // texto sobre bg.inverse
        onAccent: string; // texto sobre accent
    };
    border: {
        subtle: string; // divisores, bordes de cards
        default: string; // inputs en reposo
        strong: string; // focus, seleccionado
    };
    accent: {
        default: string; // CTA en reposo
        hover: string;
        pressed: string;
        soft: string; // bg tenue con tinte accent
        onSoft: string; // texto sobre soft
    };
    feedback: {
        successFg: string;
        successBg: string;
        warningFg: string;
        warningBg: string;
        dangerFg: string;
        dangerBg: string;
    };
    overlay: string; // backdrop de modales
};

const lightTheme: ColorTokens = {
    bg: {
        canvas: palette.stone[50],
        raised: palette.stone[0],
        sunken: palette.stone[100],
        inverse: palette.stone[950],
    },
    fg: {
        primary: palette.stone[950],
        secondary: palette.stone[700],
        tertiary: palette.stone[500],
        inverse: palette.stone[50],
        onAccent: palette.stone[0],
    },
    border: {
        subtle: palette.stone[200],
        default: palette.stone[300],
        strong: palette.stone[950],
    },
    accent: {
        default: palette.orange[600],
        hover: palette.orange[700],
        pressed: palette.orange[800],
        soft: palette.orange[100],
        onSoft: palette.orange[900],
    },
    feedback: {
        successFg: palette.green[500],
        successBg: palette.green[100],
        warningFg: palette.amber[500],
        warningBg: palette.amber[100],
        dangerFg: palette.red[500],
        dangerBg: palette.red[100],
    },
    overlay: 'rgba(10, 10, 10, 0.45)',
};

const darkTheme: ColorTokens = {
    bg: {
        canvas: palette.stone[1000],
        raised: palette.stone[900],
        sunken: palette.stone[950],
        inverse: palette.stone[50],
    },
    fg: {
        primary: palette.stone[50],
        secondary: palette.stone[300],
        tertiary: palette.stone[400],
        inverse: palette.stone[950],
        onAccent: palette.stone[0],
    },
    border: {
        subtle: palette.stone[800],
        default: palette.stone[700],
        strong: palette.stone[200],
    },
    accent: {
        default: palette.orange[500],
        hover: palette.orange[400],
        pressed: palette.orange[600],
        soft: '#33150A', // stone/950 con tinte orange — no existe en palette por claridad
        onSoft: palette.orange[200],
    },
    feedback: {
        successFg: '#4ADE80',
        successBg: palette.green[900],
        warningFg: '#FBBF24',
        warningBg: palette.amber[900],
        dangerFg: '#F87171',
        dangerBg: palette.red[900],
    },
    overlay: 'rgba(0, 0, 0, 0.72)',
};

// ---------------------------------------------------------------------------
// Tipografía
// ---------------------------------------------------------------------------
export const fontFamily = {
    /** Display — títulos con carácter. Bricolage Grotesque, grades 400–800. */
    display: 'BricolageGrotesque',
    /** Body — cuerpo, UI, labels. IBM Plex Sans. */
    body: 'IBMPlexSans',
    /** Mono — precios, SKUs, códigos. IBM Plex Mono. Da identidad a los números. */
    mono: 'IBMPlexMono',
} as const;

type TextStyle = {
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    fontWeight?: '400' | '500' | '600' | '700' | '800';
    letterSpacing?: number;
    textTransform?: 'uppercase' | 'none';
};

export const typography: Record<string, TextStyle> = {
    // Display — Bricolage, para pantallas hero o titulares fuertes
    displayXl: { fontFamily: fontFamily.display, fontSize: 44, lineHeight: 48, fontWeight: '700', letterSpacing: -0.8 },
    displayLg: { fontFamily: fontFamily.display, fontSize: 32, lineHeight: 36, fontWeight: '700', letterSpacing: -0.6 },
    displayMd: { fontFamily: fontFamily.display, fontSize: 24, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4 },
    // Heading — IBM Plex para títulos de sección, cards, modal
    headingLg: { fontFamily: fontFamily.body, fontSize: 20, lineHeight: 26, fontWeight: '600', letterSpacing: -0.2 },
    headingMd: { fontFamily: fontFamily.body, fontSize: 17, lineHeight: 22, fontWeight: '600' },
    headingSm: { fontFamily: fontFamily.body, fontSize: 15, lineHeight: 20, fontWeight: '600' },
    // Body
    bodyLg: { fontFamily: fontFamily.body, fontSize: 16, lineHeight: 24, fontWeight: '400' },
    bodyMd: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20, fontWeight: '400' },
    bodySm: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 16, fontWeight: '400' },
    // Mono — números, códigos, SKUs
    monoLg: { fontFamily: fontFamily.mono, fontSize: 20, lineHeight: 24, fontWeight: '500' },
    monoMd: { fontFamily: fontFamily.mono, fontSize: 14, lineHeight: 20, fontWeight: '400' },
    monoSm: { fontFamily: fontFamily.mono, fontSize: 12, lineHeight: 16, fontWeight: '400' },
    // Label / caption — mayúsculas para tab titles, badges
    label: {
        fontFamily: fontFamily.body,
        fontSize: 11,
        lineHeight: 14,
        fontWeight: '600',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    },
};

// ---------------------------------------------------------------------------
// Espaciado (base 4 px)
// ---------------------------------------------------------------------------
export const spacing = {
    '0': 0,
    '1': 4,
    '2': 8,
    '3': 12,
    '4': 16,
    '5': 20,
    '6': 24,
    '7': 28,
    '8': 32,
    '10': 40,
    '12': 48,
    '16': 64,
    '20': 80,
    '24': 96,
    // Aliases legacy — retirar cuando se migren todas las pantallas.
    /** @deprecated usar '1' (4 px) */ xs: 4,
    /** @deprecated usar '2' (8 px) */ sm: 8,
    /** @deprecated usar '3' (12 px) */ md: 12,
    /** @deprecated usar '4' (16 px) */ lg: 16,
    /** @deprecated usar '6' (24 px) */ xl: 24,
    /** @deprecated usar '8' (32 px) */ xxl: 32,
} as const;

// ---------------------------------------------------------------------------
// Radios, bordes, tamaños táctiles
// ---------------------------------------------------------------------------
export const radius = {
    none: 0,
    xs: 4, // chips pequeños, badges
    sm: 6,
    md: 8, // inputs, buttons
    lg: 12, // cards
    xl: 16, // sheets grandes
    '2xl': 20,
    full: 9999,
    /** @deprecated usar `full` */ pill: 9999,
} as const;

export const borderWidth = {
    none: 0,
    default: 1,
    strong: 2, // focus ring, seleccionado
} as const;

/** Mínimos de accesibilidad para targets táctiles. */
export const touch = {
    min: 48, // alto mínimo de botones y filas tocables
    icon: 44, // mínimo para íconos con hitSlop
} as const;

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------
export const motion = {
    duration: {
        instant: 0,
        fast: 120, // press, toggle, hover
        normal: 180, // transiciones entre estados, fade
        slow: 280, // sheets, modals, navegación
        deliberate: 400, // sólo para hero, onboarding
    },
    easing: {
        // Curvas tipo Material 3 "standard" — sin rebote, precisas.
        standard: [0.2, 0, 0, 1] as const,
        emphasized: [0.2, 0, 0.1, 1] as const,
        exit: [0.4, 0, 1, 1] as const,
    },
} as const;

// ---------------------------------------------------------------------------
// Sombras (usadas con mesura — Swiss principle)
// ---------------------------------------------------------------------------
export const shadow = {
    none: {
        shadowColor: 'transparent',
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
    },
    sm: {
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
    },
    md: {
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
    },
    lg: {
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
    },
} as const;

// ---------------------------------------------------------------------------
// Theme object expuesto por el hook
// ---------------------------------------------------------------------------
export type Theme = {
    mode: 'light' | 'dark';
    color: ColorTokens;
    font: typeof fontFamily;
    type: typeof typography;
    space: typeof spacing;
    radius: typeof radius;
    border: typeof borderWidth;
    touch: typeof touch;
    motion: typeof motion;
    shadow: typeof shadow;
};

export const themes = {
    light: {
        mode: 'light' as const,
        color: lightTheme,
        font: fontFamily,
        type: typography,
        space: spacing,
        radius,
        border: borderWidth,
        touch,
        motion,
        shadow,
    } satisfies Theme,
    dark: {
        mode: 'dark' as const,
        color: darkTheme,
        font: fontFamily,
        type: typography,
        space: spacing,
        radius,
        border: borderWidth,
        touch,
        motion,
        shadow,
    } satisfies Theme,
};

// Compat: algunos componentes existentes importan `colors`, `type`, `spacing`
// como shape plano. Se deprecan pero siguen exportados hasta que se migren.
/** @deprecated usar `useTheme().color` */
export const colors = {
    bg: lightTheme.bg.canvas,
    surface: lightTheme.bg.raised,
    surfaceAlt: lightTheme.bg.sunken,
    border: lightTheme.border.subtle,
    text: lightTheme.fg.primary,
    textMuted: lightTheme.fg.tertiary,
    accent: lightTheme.accent.default,
    accentDark: lightTheme.accent.pressed,
    danger: lightTheme.feedback.dangerFg,
    success: lightTheme.feedback.successFg,
};

/** @deprecated usar `useTheme().type.*` */
export const type = {
    display: typography.displayMd,
    title: typography.headingLg,
    body: typography.bodyMd,
    mono: typography.monoMd,
    label: typography.label,
};
