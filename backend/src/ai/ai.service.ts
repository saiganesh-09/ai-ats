import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

export interface MatchResult {
  score: number;
  matched_skills: string[];
  missing_skills: string[];
  explanation: string;
}

export interface ParsedResume {
  summary: string;
  skills: string[];
  experience: unknown[];
  education: unknown[];
}

const SKILLS_VOCAB = [
  'python', 'javascript', 'typescript', 'react', 'next.js', 'node', 'express',
  'nestjs', 'fastapi', 'django', 'sql', 'postgresql', 'mysql', 'mongodb',
  'redis', 'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'git', 'ci/cd',
  'rest', 'graphql', 'machine learning', 'pandas', 'java', 'go', 'rust',
  'c++', 'html', 'css', 'tailwind', 'prisma', 'linux', 'agile',
];

/**
 * AI service: one boundary for all LLM features. Every public method has a
 * deterministic mock fallback used when OPENAI_API_KEY is unset or the API
 * call fails — the AI is an enhancement, never a hard dependency.
 * Routers/services call these methods without caring which path ran.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: OpenAI | null = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;
  private model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

  private async chatJson(prompt: string): Promise<Record<string, unknown>> {
    if (!this.client) throw new Error('no client');
    const resp = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });
    return JSON.parse(resp.choices[0].message.content ?? '{}');
  }

  private async tryAi<T>(prompt: string, mock: () => T): Promise<T> {
    if (!this.client) return mock();
    try {
      return (await this.chatJson(prompt)) as T;
    } catch (e) {
      this.logger.warn(`OpenAI call failed, using mock fallback: ${e}`);
      return mock();
    }
  }

  // ---------- resume parsing ----------

  parseResume(rawText: string): Promise<ParsedResume> {
    const prompt = `You are an ATS resume parser. Extract structured data from the
resume text below. Respond with ONLY valid JSON in exactly this shape:
{"summary":"2-3 sentence professional summary","skills":["skill1"],"experience":[{"title":"...","company":"...","years":2,"highlights":["..."]}],"education":[{"degree":"...","institution":"...","year":2020}]}

RESUME TEXT:
${rawText.slice(0, 12000)}`;
    return this.tryAi(prompt, () => this.mockParse(rawText));
  }

  // ---------- candidate-job matching ----------

  scoreMatch(
    parsedResume: unknown,
    title: string,
    description: string,
    requirements?: string | null,
  ): Promise<MatchResult> {
    const prompt = `You are an ATS matching engine. Score how well this candidate's
parsed resume matches the job. Respond with ONLY valid JSON in this shape:
{"score":0-100,"matched_skills":["..."],"missing_skills":["..."],"explanation":"2-3 sentences"}

JOB TITLE: ${title}
JOB DESCRIPTION: ${description.slice(0, 6000)}
JOB REQUIREMENTS: ${requirements ?? 'N/A'}

PARSED RESUME: ${JSON.stringify(parsedResume).slice(0, 6000)}`;
    return this.tryAi(prompt, () =>
      this.mockScore(parsedResume, description, requirements),
    );
  }

  // ---------- candidate summary ----------

  summarizeCandidate(parsedResume: unknown, jobTitle: string): Promise<{ summary: string }> {
    const prompt = `Write a 3-4 sentence recruiter-facing summary of this candidate
for the role "${jobTitle}". Highlight relevant strengths and one potential concern.
Respond with ONLY valid JSON: {"summary":"..."}

PARSED RESUME: ${JSON.stringify(parsedResume).slice(0, 6000)}`;
    return this.tryAi(prompt, () => {
      const skills = (parsedResume as ParsedResume)?.skills ?? [];
      return {
        summary: `Candidate profile lists ${skills.length} skills including ${skills.slice(0, 4).join(', ') || 'none detected'}. Review the parsed resume for details. (Mock summary — set OPENAI_API_KEY for real AI summaries.)`,
      };
    });
  }

  // ---------- interview question generation ----------

  generateInterviewQuestions(
    parsedResume: unknown,
    title: string,
    description: string,
  ): Promise<{ questions: string[] }> {
    const prompt = `Generate 6 interview questions for a "${title}" role, tailored to
this candidate's background — mix technical, behavioral, and gap-probing questions
about skills the job needs but the resume may lack.
Respond with ONLY valid JSON: {"questions":["q1","q2",...]}

JOB DESCRIPTION: ${description.slice(0, 4000)}
PARSED RESUME: ${JSON.stringify(parsedResume).slice(0, 4000)}`;
    return this.tryAi(prompt, () => {
      const jobSkills = this.foundSkills(`${title} ${description}`);
      return {
        questions: [
          `Walk me through your experience with ${jobSkills[0] ?? 'the core stack'} — what did you build?`,
          `Describe a difficult technical problem you solved recently.`,
          `This role uses ${jobSkills.slice(0, 3).join(', ')} — which are you strongest and weakest in?`,
          `Tell me about a time you had to learn a new technology quickly.`,
          `How do you approach testing and code quality?`,
          `Why are you interested in this ${title} role specifically?`,
        ],
      };
    });
  }

  // ---------- job description analysis ----------

  analyzeJobDescription(title: string, description: string): Promise<Record<string, unknown>> {
    const prompt = `Analyze this job description for a "${title}" posting. Respond with
ONLY valid JSON: {"required_skills":["..."],"nice_to_have":["..."],"seniority":"junior|mid|senior|lead","clarity_score":0-100,"suggestions":["one improvement per item"]}

DESCRIPTION: ${description.slice(0, 6000)}`;
    return this.tryAi(prompt, () => ({
      required_skills: this.foundSkills(description),
      nice_to_have: [],
      seniority: 'mid',
      clarity_score: 70,
      suggestions: ['Mock analysis — set OPENAI_API_KEY for real JD analysis.'],
    }));
  }

  // ---------- mock implementations ----------

  private foundSkills(text: string): string[] {
    const lowered = text.toLowerCase();
    return SKILLS_VOCAB.filter((s) =>
      new RegExp(`\\b${s.replace(/[+.]/g, '\\$&')}\\b`).test(lowered),
    );
  }

  private mockParse(rawText: string): ParsedResume {
    const firstLine = rawText.split('\n').find((l) => l.trim()) ?? '';
    return {
      summary: firstLine.slice(0, 300) || 'No summary extracted',
      skills: this.foundSkills(rawText),
      experience: [],
      education: [],
    };
  }

  private mockScore(
    parsedResume: unknown,
    description: string,
    requirements?: string | null,
  ): MatchResult {
    const jobSkills = new Set(this.foundSkills(`${description} ${requirements ?? ''}`));
    const resumeSkills = new Set(
      ((parsedResume as ParsedResume)?.skills ?? []).map((s) => s.toLowerCase()),
    );
    const matched = [...jobSkills].filter((s) => resumeSkills.has(s)).sort();
    const missing = [...jobSkills].filter((s) => !resumeSkills.has(s)).sort();
    const score = jobSkills.size ? Math.round((100 * matched.length) / jobSkills.size) : 50;
    return {
      score,
      matched_skills: matched,
      missing_skills: missing,
      explanation: `Heuristic match: candidate has ${matched.length} of ${jobSkills.size} skills mentioned in the job posting.`,
    };
  }
}
