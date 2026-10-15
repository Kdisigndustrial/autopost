import { TIMEZONE, slotToISO } from './schedule';
import { PlatformResult } from './storage';

// ---------- Copies con Claude ----------

export interface Copy {
  title: string;
  caption: string;
}

const MODEL = 'claude-sonnet-5-5';

export async function generateCopy(opts: {
  apiKey: string;
  voice: string;
  notes: string;
  fileName?: string;
}): Promise<Copy> {
  if (!opts.apiKey) throw new Error('Falta la clave de Anthropic (Ajustes).');
  const system = `Escribís copies para videos cortos que se publican en TikTok y YouTube Shorts.
El mismo texto se usa en las dos plataformas.

GUÍA DE VOZ DE LA MARCA:
${opts.voice}

FORMATO DE SALIDA: respondé SOLO con JSON válido, sin texto antes ni después:
{"title": "...", "caption": "..."}
- "title": título para YouTube Shorts, máximo 80 caracteres, sin hashtags.
- "caption": el copy completo (1 a 4 líneas cortas) y al final una línea con 5 a 8 hashtags relevantes, mezclando de nicho y amplios, incluyendo #shorts. Máximo 600 caracteres en total.
Todo en castellano.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': opts.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      system,
      messages: [
        {
          role: 'user',
          content: `De qué trata el video (mis palabras): ${opts.notes || '(sin descripción)'}${
            opts.fileName ? `\nNombre del archivo: ${opts.fileName}` : ''
          }`,
        },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Error de Claude (${res.status})`);
  const text: string = (data.content ?? []).map((c: any) => c.text ?? '').join('');
  const match = text.match(/\{[\s\S]*\}/);
  try {
    const parsed = JSON.parse(match ? match[0] : text);
    return { title: String(parsed.title ?? '').slice(0, 100), caption: String(parsed.caption ?? '') };
  } catch {
    return { title: text.split('\n')[0].slice(0, 100), caption: text };
  }
}

// ---------- Publicación con Upload-Post ----------

const UP_BASE = 'https://api.upload-post.com/api';

export function extractHashtags(caption: string): string[] {
  return Array.from(new Set((caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((h) => h.slice(1)))).slice(0, 15);
}

export async function schedulePost(opts: {
  apiKey: string;
  profile: string;
  video: { uri: string; name: string; type: string };
  title: string;
  caption: string;
  slot: string;
}): Promise<{ jobId?: string }> {
  if (!opts.apiKey) throw new Error('Falta la clave de Upload-Post (Ajustes).');
  if (!opts.profile) throw new Error('Falta el nombre del perfil de Upload-Post para esta marca (Ajustes).');

  const form = new FormData();
  form.append('user', opts.profile);
  form.append('platform[]', 'tiktok');
  form.append('platform[]', 'youtube');
  // React Native acepta {uri, name, type} como archivo
  form.append('video', { uri: opts.video.uri, name: opts.video.name, type: opts.video.type } as any);
  form.append('title', opts.title || opts.caption.slice(0, 100));
  // TikTok: el copy completo va como título/caption
  form.append('tiktok_title', opts.caption.slice(0, 2200));
  form.append('privacy_level', 'PUBLIC_TO_EVERYONE');
  form.append('post_mode', 'DIRECT_POST');
  // YouTube
  form.append('youtube_title', (opts.title || opts.caption).slice(0, 100));
  form.append('description', opts.caption);
  form.append('privacyStatus', 'public');
  form.append('defaultLanguage', 'es');
  for (const tag of extractHashtags(opts.caption)) form.append('tags[]', tag);
  // Programación
  form.append('scheduled_date', slotToISO(opts.slot));
  form.append('timezone', TIMEZONE);

  const res = await fetch(`${UP_BASE}/upload`, {
    method: 'POST',
    headers: { Authorization: `Apikey ${opts.apiKey.trim()}` },
    body: form,
  });
  let data: any = {};
  try {
    data = await res.json();
  } catch {}
  if (!res.ok || data?.success === false) {
    throw new Error(data?.message ?? data?.error ?? `Error de Upload-Post (${res.status})`);
  }
  return { jobId: data.job_id };
}

export async function fetchJobStatus(apiKey: string, jobId: string): Promise<{
  status: string;
  results: PlatformResult[];
}> {
  const res = await fetch(`${UP_BASE}/uploadposts/status?job_id=${encodeURIComponent(jobId)}`, {
    headers: { Authorization: `Apikey ${apiKey.trim()}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? data?.message ?? `Error (${res.status})`);
  return {
    status: data.status,
    results: (data.results ?? []).map((r: any) => ({
      platform: r.platform,
      success: !!r.success,
      message: r.message ?? r.error,
    })),
  };
}
