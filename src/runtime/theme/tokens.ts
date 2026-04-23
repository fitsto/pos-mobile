// Distinct POS tone: industrial-utilitarian with warm accent.
// Dark charcoal base + a single saturated amber highlight.
export const colors = {
  bg: '#0E1013',
  surface: '#151A1F',
  surfaceAlt: '#1F2730',
  border: '#2A333D',
  text: '#EDEEF0',
  textMuted: '#8A94A0',
  accent: '#F5A524',
  accentDark: '#B97A12',
  danger: '#E5484D',
  success: '#30A46C',
};

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const type = {
  display: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  title: { fontSize: 20, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  mono: { fontFamily: 'Courier', fontSize: 14 },
  label: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 1, textTransform: 'uppercase' as const },
};
