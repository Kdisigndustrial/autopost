export type BrandId = 'navaja' | 'zapodub';

export interface Brand {
  id: BrandId;
  name: string;
  accent: string;
  /** Voz por defecto. Se puede editar desde Ajustes. */
  defaultVoice: string;
}

export const BRANDS: Brand[] = [
  {
    id: 'navaja',
    name: 'NAVAJA',
    accent: '#FF3B2F',
    defaultVoice: `Marca: NAVAJA Skateboards (Argentina). Marca de skate con escuela de skate y team.
Tono: callejero, crudo, directo. Estética pop art argentina hardcore (referencias visuales: Kosice, Berni, Quinquela Martín) — no hace falta nombrarlos, es la actitud.
Idioma: castellano rioplatense con voseo, mezclado con terminología de skate en inglés (kickflip, grind, ollie, session, spot, deck, setup, line, bail, etc.).
Tipos de contenido: trucos y sesiones de skate, productos/tablas (drops), eventos y contests, escuela de skate.
Reglas: frases cortas, nada corporativo, nada de "¡Hola comunidad!". Emojis pocos o ninguno.`,
  },
  {
    id: 'zapodub',
    name: 'ZAPODUB',
    accent: '#3BE38C',
    defaultVoice: `Proyecto: ZAPODUB — producción de techno y dub (Ableton), artista / DJ / productor argentino.
Tono: oscuro, hipnótico, underground, con algo de misterio. Habla de sonido, groove, bajo, texturas, estudio, live sets.
Idioma: castellano rioplatense con voseo; términos técnicos de música electrónica en inglés cuando es natural (track, set, groove, low end, dub techno, delay).
Tipos de contenido: fragmentos de tracks, procesos de estudio, sets en vivo, anuncios de lanzamientos o fechas.
Reglas: frases cortas, evocativas. Nada de exageraciones tipo "¡el mejor track del año!". Emojis mínimos.`,
  },
];

export const brandById = (id: BrandId) => BRANDS.find((b) => b.id === id)!;
