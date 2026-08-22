// Cloudflare Workers API access: course-data query and "add to system cart".
// URL / TOKEN / TERM are configured in the UI and stored by src/state.ts.
import type { ApiConfig, Course, Entry } from '../types';

export async function fetchApiPayload(cfg: ApiConfig, type: string){
  const base = String(cfg.url || '').trim().replace(/\/+$/, '');
  if (!base) throw new Error('API URL is empty');
  const qs = new URLSearchParams();
  qs.set('TYPE', type);
  if (String(cfg.termId || '').trim()) qs.set('TERM_ID', String(cfg.termId).trim());
  if (String(cfg.token || '').trim()) qs.set('TOKEN', String(cfg.token).trim());
  const res = await fetch(base + '/?' + qs.toString(), { cache: 'no-store' });
  let body = null;
  try{ body = await res.json(); }catch(ex){ throw new Error('API returned non-JSON (HTTP ' + res.status + ')'); }
  if (!res.ok || (body && typeof body === 'object' && body.error)){
    throw new Error((body && body.error) ? String(body.error) : 'HTTP ' + res.status);
  }
  const payload = Array.isArray(body) ? body
    : (body && Array.isArray(body.data) ? body.data
    : (body && Array.isArray(body.records) ? body.records : null));
  if (!payload) throw new Error('API response has no data array');
  return payload;
}

export async function addToSystemCart(cfg: ApiConfig, schedule: Entry[], coursesById: Record<string, Course>){
  const token = String(cfg.token || '').trim();
  if (!token) throw new Error('missing-token');
  if (!schedule || !schedule.length) throw new Error('empty-schedule');
  const base = String(cfg.cartUrl || '').trim().replace(/\/+$/, '');
  if (!base) throw new Error('empty-cart-url');
  const idsByType = { sisn: [], klms: [] };
  const seen = {};
  for (const en of schedule){
    if (seen[en.section]) continue;
    seen[en.section] = true;
    const c = en.course && coursesById && coursesById[en.course];
    const type = (c && c.cartSystem) ? c.cartSystem : ((c && c.klms) ? 'klms' : 'sisn');
    idsByType[type].push(en.section);
  }
  let added = 0, failed = [];
  const errors = [];
  // SISN and KLMS are independent systems: one failing (network / auth / upstream)
  // must not prevent the other request from being sent. Failures are collected
  // per system and reported alongside the combined result.
  for (const type of ['sisn', 'klms']){
    const ids = idsByType[type];
    if (!ids.length) continue;
    try{
      const r = await postToCart(base, token, type, ids);
      added += r.added;
      failed = failed.concat(r.failedIds);
    }catch(ex){
      errors.push(type.toUpperCase() + ': ' + (ex && ex.message ? ex.message : String(ex)));
    }
  }
  return { added: added, failed: failed, errors: errors };
}

async function postToCart(base: string, token: string, type: string, ids: string[]){
  const qs = new URLSearchParams();
  qs.set('TOKEN', token);
  qs.set('TYPE', type);
  const res = await fetch(base + '/?' + qs.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classIds: ids })
  });
  let body = null;
  try{ body = await res.json(); }catch(ex){ throw new Error('cart API returned non-JSON (HTTP ' + res.status + ')'); }
  if (!res.ok || (body && body.error)){
    throw new Error((body && body.error) ? String(body.error) : 'HTTP ' + res.status);
  }
  if (body && body._decryptError) throw new Error('cart response decryption failed: ' + body._decryptError);
  if (body && body.code !== undefined && body.code !== null && String(body.code) !== '0'){
    throw new Error((body && body.message) ? String(body.message) : 'upstream error ' + body.code);
  }
  const data = body && typeof body.data === 'object' ? body.data : null;
  const failedIds = (data && Array.isArray(data.failedIds)) ? data.failedIds.map(String) : [];
  const successCount = (data && isFinite(Number(data.successCount))) ? Number(data.successCount) : null;
  const added = successCount != null ? Math.max(0, successCount) : Math.max(0, ids.length - failedIds.length);
  return { added: added, failedIds: failedIds };
}
