/**
 * Validation + sanitization of AI-parsed resume output.
 *
 * The LLM is a third party: its JSON can contain wrong types, HTML/XSS,
 * oversized strings, junk fields. Spec: "do not blindly trust AI output" —
 * everything passes through here before touching the database.
 */

export interface ParsedResumeData {
  name?: string;
  email?: string;
  phone?: string;
  summary?: string;
  skills?: string[];
  experience?: Record<string, unknown>[];
  education?: Record<string, unknown>[];
  certifications?: Record<string, unknown>[];
  projects?: Record<string, unknown>[];
}

const stripHtml = (s: string) =>
  s.replace(/<[^>]*>/g, '').replace(/[\x00-\x1f]/g, '').trim();

const cleanStr = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const s = stripHtml(v).slice(0, max);
  return s || undefined;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+()\-.\s\d]{7,20}$/;

function cleanSkills(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const s = cleanStr(item, 50)?.toLowerCase();
    if (s && s.length <= 50 && !out.includes(s)) out.push(s);
    if (out.length >= 40) break; // cap — AI sometimes dumps the whole thesaurus
  }
  return out;
}

const ALLOWED_KEYS: Record<string, string[]> = {
  experience: ['title', 'company', 'years', 'description', 'start', 'end'],
  education: ['degree', 'institution', 'year', 'field'],
  certifications: ['name', 'issuer', 'year'],
  projects: ['name', 'description', 'technologies', 'url'],
};

function cleanRecords(v: unknown, kind: keyof typeof ALLOWED_KEYS): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null && !Array.isArray(r))
    .slice(0, 15)
    .map((r) => {
      const out: Record<string, unknown> = {};
      for (const key of ALLOWED_KEYS[kind]) {
        const val = r[key];
        if (typeof val === 'string') {
          const s = cleanStr(val, 200);
          if (s) out[key] = s;
        } else if (typeof val === 'number' && Number.isFinite(val)) {
          out[key] = Math.round(val);
        }
      }
      return out;
    })
    .filter((r) => Object.keys(r).length > 0); // drop empty objects
}

/** Sanitize raw AI output → safe ParsedResumeData. Anything unusable is dropped. */
export function sanitizeParsed(raw: unknown): ParsedResumeData {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const email = cleanStr(r.email, 100);
  const phone = cleanStr(r.phone, 20);
  return {
    ...(cleanStr(r.name, 100) ? { name: cleanStr(r.name, 100) } : {}),
    ...(email && EMAIL_RE.test(email) ? { email } : {}),
    ...(phone && PHONE_RE.test(phone) ? { phone } : {}),
    ...(cleanStr(r.summary, 800) ? { summary: cleanStr(r.summary, 800) } : {}),
    skills: cleanSkills(r.skills),
    experience: cleanRecords(r.experience, 'experience'),
    education: cleanRecords(r.education, 'education'),
    certifications: cleanRecords(r.certifications, 'certifications'),
    projects: cleanRecords(r.projects, 'projects'),
  };
}

/** Safe display filename: strip path traversal + weird chars, keep it readable. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'resume';
  const safe = base.replace(/[^\w.\- ()]/g, '_').slice(0, 120);
  return safe || 'resume';
}
