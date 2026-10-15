/**
 * Autopost — "hoja de taller impresa en riso".
 * Fondo de concreto, tinta negra pura, y cada marca como una tinta riso
 * que aparece desfasada detrás de sus tarjetas (como un registro corrido).
 */
export const color = {
  concrete: '#D6D8D3', // fondo
  plate: '#F1F2EE', // superficies
  ink: '#000000', // texto, bordes, botones
  graphite: '#5E615C', // texto secundario
  rule: '#A9ACA6', // líneas punteadas / vacíos
  alert: '#D7261E', // errores
  done: '#00A95C', // publicado (riso verde)
};

export const font = {
  display: 'BigShoulders-Black',
  displayBold: 'BigShoulders-Bold',
  body: 'Archivo-Regular',
  bodyMedium: 'Archivo-Medium',
  bodyBold: 'Archivo-SemiBold',
};

export const fontFiles = {
  [font.display]: require('@expo-google-fonts/big-shoulders-display/BigShouldersDisplay_900Black.ttf'),
  [font.displayBold]: require('@expo-google-fonts/big-shoulders-display/BigShouldersDisplay_700Bold.ttf'),
  [font.body]: require('@expo-google-fonts/archivo/400Regular/Archivo_400Regular.ttf'),
  [font.bodyMedium]: require('@expo-google-fonts/archivo/500Medium/Archivo_500Medium.ttf'),
  [font.bodyBold]: require('@expo-google-fonts/archivo/600SemiBold/Archivo_600SemiBold.ttf'),
};

/** Escala tipográfica (base 16, razón ~1.25) */
export const type = {
  hero: { fontFamily: font.display, fontSize: 44, lineHeight: 44, color: color.ink },
  h1: { fontFamily: font.display, fontSize: 32, lineHeight: 34, color: color.ink },
  h2: { fontFamily: font.display, fontSize: 24, lineHeight: 26, color: color.ink },
  time: { fontFamily: font.display, fontSize: 26, lineHeight: 28, color: color.ink },
  body: { fontFamily: font.body, fontSize: 16, lineHeight: 23, color: color.ink },
  bodyStrong: { fontFamily: font.bodyBold, fontSize: 16, lineHeight: 22, color: color.ink },
  label: { fontFamily: font.bodyBold, fontSize: 14, lineHeight: 18, color: color.ink },
  small: { fontFamily: font.body, fontSize: 13, lineHeight: 18, color: color.graphite },
} as const;

export const BORDER = 2;
export const OFFSET = 5; // desfase de la tinta de marca
