import { sanitizeParsed } from './parsed-resume';

describe('sanitizeParsed — never trust AI output', () => {
  it('strips HTML/XSS from all string fields', () => {
    const out = sanitizeParsed({
      name: '<script>alert(1)</script>Dave',
      email: 'a@b.co',
      phone: '555-1234',
      skills: [],
      education: [],
      experience: [],
      certifications: [],
      projects: [],
    });
    expect(out.name).not.toContain('<script>');
    expect(out.name).toBe('alert(1)Dave');
  });

  it('drops invalid email/phone', () => {
    const out = sanitizeParsed({ email: 'not-an-email', phone: 'call me maybe' });
    expect(out.email).toBeUndefined();
    expect(out.phone).toBeUndefined();
  });

  it('dedupes + normalizes skills and caps the list', () => {
    const out = sanitizeParsed({
      skills: ['TS', 'ts', 'TypeScript', ...Array(100).fill('x')],
    });
    expect(new Set(out.skills).size).toBe(out.skills.length);
    expect(out.skills).toContain('typescript');
    expect(out.skills.length).toBeLessThanOrEqual(50);
  });

  it('whitelists record fields — unknown keys are dropped', () => {
    const out = sanitizeParsed({
      experience: [{ title: 'Eng', company: 'X', secretField: 'leak' }],
    });
    expect(out.experience[0]).not.toHaveProperty('secretField');
    expect(out.experience[0].title).toBe('Eng');
  });

  it('returns a safe empty shape for malformed input', () => {
    const out = sanitizeParsed(null);
    expect(out.skills).toEqual([]);
    expect(out.experience).toEqual([]);
  });
});
