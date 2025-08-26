export const theme = {
  colors: {
    primary: '#667eea',
    primaryDark: '#5a67d8',
    primaryLight: '#a5b4fc',
    secondary: '#f7fafc',
    background: '#ffffff',
    backgroundSecondary: '#f7fafc',
    text: '#2d3748',
    textPrimary: '#2d3748',
    textSecondary: '#718096',
    white: '#ffffff',
    border: '#e2e8f0',
    gray100: '#f7fafc',
    gray200: '#edf2f7',
    success: '#48bb78'
  },
  fontSizes: {
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem'
  },
  fontWeights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  },
  spacing: {
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '2.5rem',
    '3xl': '3rem'
  },
  borderRadius: {
    md: '0.5rem',
    full: '9999px'
  },
  breakpoints: {
    sm: '640px',
    md: '768px'
  },
  shadows: {
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
  },
  transitions: {
    fast: '150ms ease-in-out',
    normal: '300ms ease-in-out'
  },
  lineHeights: {
    relaxed: '1.625'
  }
};

export type Theme = typeof theme;
