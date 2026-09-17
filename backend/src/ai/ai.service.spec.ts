import { AiService } from './ai.service';

/**
 * Matching logic — the deterministic mock path (no OPENAI_API_KEY).
 * mockScore(parsedResume, description, requirements) extracts job skills
 * from text via SKILLS_VOCAB and scores overlap.
 */
describe('AiService matching logic (mock fallback)', () => {
  const ai = new AiService();
  const score = (resume: unknown, desc: string, req?: string) =>
    ai['mockScore'](resume, desc, req);

  it('scores full overlap at 100', () => {
    const r = score(
      { skills: ['docker', 'node'] },
      'We need docker and node experience',
    );
    expect(r.score).toBe(100);
    expect(r.missing_skills).toEqual([]);
  });

  it('identifies missing skills on partial overlap', () => {
    const r = score(
      { skills: ['node', 'sql'] },
      'docker node sql aws required',
    );
    expect(r.score).toBe(50); // 2 of 4 skills
    expect(r.matched_skills).toEqual(expect.arrayContaining(['node', 'sql']));
    expect(r.missing_skills).toEqual(expect.arrayContaining(['docker', 'aws']));
  });

  it('scores zero overlap at 0', () => {
    const r = score({ skills: ['python'] }, 'rust developer wanted');
    expect(r.score).toBe(0);
    expect(r.matched_skills).toEqual([]);
  });

  it('marks education UNKNOWN when resume has no education entries', () => {
    const r = score({ skills: ['docker'], education: [] }, 'docker engineer');
    expect(r.education_match).toBe('UNKNOWN');
  });

  it('bands experience by score', () => {
    const strong = score({ skills: ['docker'] }, 'docker only', '');
    expect(strong.experience_match).toBe('STRONG');
  });
});
