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

/** Próximo horario libre (12 o 20 hs) para esa marca, a partir de ahora */
export function nextFreeSlot(brand: BrandId, queue: QueueItem[]): string {
  const taken = new Set(
    queue.filter((q) => q.brand === brand && q.status !== 'failed').map((q) => q.slot),
  );
  const cutoff = Date.now() + MIN_LEAD_MIN * 60_000;
  const base = nowAR();
  for (let d = 0; d < 400; d++) {
    const day = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + d));
    for (const h of SLOT_HOURS) {
      const slot = `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}T${pad(h)}:00`;
      if (slotToTime(slot) > cutoff && !taken.has(slot)) return slot;
    }
  }
  throw new Error('No hay horarios libres en el próximo año');
}

const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

export function formatSlot(slot: string): string {
  const d = new Date(`${slot}:00Z`);
  return `${DAYS[d.getUTCDay()]} ${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)} · ${slot.slice(11)} hs`;
}
