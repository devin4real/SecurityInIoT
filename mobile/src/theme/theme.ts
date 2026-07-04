// Theme system — Modern gradient color palette & design tokens

export const colors = {
  // Primary gradient (Blue → Purple)
  primary: '#6C63FF',
  primaryDark: '#5A52D5',
  primaryLight: '#8B83FF',

  // Gradient stops
  gradientStart: '#667EEA',
  gradientEnd: '#764BA2',

  // Accent
  accent: '#FF6B6B',
  accentLight: '#FF8E8E',

  // Neutrals
  white: '#FFFFFF',
  offWhite: '#F7F8FC',
  lightGray: '#E8ECF4',
  gray: '#8391A1',
  darkGray: '#6A707C',
  dark: '#1E232C',
  black: '#000000',

  // Semantic
  success: '#2ED573',
  error: '#FF4757',
  warning: '#FFA502',
  info: '#3742FA',

  // Card & Surface
  cardBg: '#FFFFFF',
  cardBorder: '#E8ECF4',
  overlay: 'rgba(0, 0, 0, 0.5)',

  // Input
  inputBg: '#F7F8F9',
  inputBorder: '#E8ECF4',
  inputBorderFocus: '#6C63FF',
  inputText: '#1E232C',
  placeholder: '#8391A1',
};

export const typography = {
  fontSizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
    hero: 36,
  },
  fontWeights: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
    extraBold: '800' as const,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
};
