import { BrandId } from './brands';
import { QueueItem } from './storage';

/** Horarios fijos de publicación, hora Argentina */
export const SLOT_HOURS = [12, 20];
export const TIMEZONE = 'America/Argentina/Buenos_Aires';
/** Argentina está en UTC-3 todo el año (sin horario de verano) */
const AR_OFFSET_MIN = -3 * 60;
/** Margen mínimo antes de un horario para que llegue a subirse */
const MIN_LEAD_MIN = 15;

const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha/hora actual expresada en hora Argentina (campos UTC del Date = hora AR) */
function nowAR(): Date {
  return new Date(Date.now() + AR_OFFSET_MIN * 60_000);
}

export function slotToISO(slot: string) {
  return `${slot}:00`;
}

/** Convierte un slot "YYYY-MM-DDTHH:mm" (hora AR) a timestamp real */
export function slotToTime(slot: string): number {
  return Date.parse(`${slot}:00Z`) - AR_OFFSET_MIN * 60_000;
}

export const isSlotUpcoming = (slot: string) => slotToTime(slot) > Date.now() + MIN_LEAD_MIN * 60_000;

/** Días (YYYY-MM-DD) desde hoy, hora Argentina */
export function upcomingDays(count: number): string[] {
  const base = nowAR();
  return Array.from({ length: count }, (_, d) => {
    const day = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + d));
    return `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`;
  });
}

export const slotFor = (day: string, hour: number) => `${day}T${pad(hour)}:00`;

export function takenSlots(brand: BrandId, queue: QueueItem[]): Set<string> {
  return new Set(queue.filter((q) => q.brand === brand && q.status !== 'failed').map((q) => q.slot));
}

/** Próximos horarios libres (12 o 20 hs) para esa marca */
export function freeSlots(brand: BrandId, queue: QueueItem[], count: number): string[] {
  const taken = takenSlots(brand, queue);
  const out: string[] = [];
  for (const day of upcomingDays(400)) {
    for (const h of SLOT_HOURS) {
      const slot = slotFor(day, h);
      if (isSlotUpcoming(slot) && !taken.has(slot)) out.push(slot);
      if (out.length >= count) return out;
    }
  }
  return out;
}

export function nextFreeSlot(brand: BrandId, queue: QueueItem[]): string {
  const [s] = freeSlots(brand, queue, 1);
  if (!s) throw new Error('No hay horarios libres en el próximo año');
  return s;
}

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "Hoy", "Mañana" o "Vie 16 oct" */
export function formatDay(day: string): string {
  const [today, tomorrow] = upcomingDays(2);
  if (day === today) return 'Hoy';
  if (day === tomorrow) return 'Mañana';
  const d = new Date(`${day}T00:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Hoy, 20:00" / "Vie 16 oct, 12:00" */
export function formatSlot(slot: string): string {
  return `${formatDay(slot.slice(0, 10))}, ${slot.slice(11)}`;
}
