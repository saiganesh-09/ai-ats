import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

export interface CandidateInsights {
  summary: string;
  key_skills: string[];
  relevant_experience: string;
  strengths: string[];
  missing_requirements: string[];
  interview_areas: string[];
}

export interface QuestionBank {
  technical: string[];
  behavioral: string[];
  project_based: string[];
  role_specific: string[];
  situational: string[];
}

export interface MatchResult {
  score: number;
  matched_skills: string[];
  missing_skills: string[];
  experience_match: 'STRONG' | 'PARTIAL' | 'WEAK';
  education_match: 'STRONG' | 'PARTIAL' | 'WEAK' | 'UNKNOWN';
  explanation: string;
}

export interface ParsedResume {
  name?: string;
  email?: string;
  phone?: string;
  summary: string;
  skills: string[];
  experience: unknown[];
  education: unknown[];
  certifications?: unknown[];
  projects?: unknown[];
}

const SKILLS_VOCAB = [
  'python',
  'javascript',
  'typescript',
  'react',
  'next.js',
  'node',
  'express',
  'nestjs',
  'fastapi',
  'django',
  'sql',
  'postgresql',
  'mysql',
  'mongodb',
  'redis',
  'docker',
  'kubernetes',
  'aws',
  'gcp',
  'azure',
  'git',
  'ci/cd',
  'rest',
  'graphql',
  'machine learning',
  'pandas',
  'java',
  'go',
  'rust',
  'c++',
  'html',
  'css',
  'tailwind',
  'prisma',
  'linux',
  'agile',
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
    return JSON.parse(resp.choices[0].message.content ?? '{}') as Record<
      string,
      unknown
    >;
  }

  private async tryAi<T>(prompt: string, mock: () => T): Promise<T> {
    if (!this.client) return mock();
    try {
      return (await this.chatJson(prompt)) as T;
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      this.logger.warn(`OpenAI call failed, using mock fallback: ${reason}`);
      return mock();
    }
  }

  // ---------- resume parsing ----------

  parseResume(rawText: string): Promise<ParsedResume> {
    const prompt = `You are an ATS resume parser. Extract structured data from the
resume text below. Respond with ONLY valid JSON in exactly this shape:
{"name":"full name","email":"...","phone":"...","summary":"2-3 sentence professional summary","skills":["skill1"],"experience":[{"title":"...","company":"...","years":2,"description":"..."}],"education":[{"degree":"...","institution":"...","year":2020}],"certifications":[{"name":"...","issuer":"...","year":2021}],"projects":[{"name":"...","description":"...","technologies":"..."}]}
Omit a field entirely if the resume does not contain it.

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
{"score":0-100,"matched_skills":["..."],"missing_skills":["..."],"experience_match":"STRONG|PARTIAL|WEAK","education_match":"STRONG|PARTIAL|WEAK|UNKNOWN","explanation":"2-3 sentences"}
experience_match judges how well the candidate's work history fits the role's
seniority and domain; education_match judges degrees/certifications vs the
posting's education requirements (UNKNOWN if unstated).

JOB TITLE: ${title}
JOB DESCRIPTION: ${description.slice(0, 6000)}
JOB REQUIREMENTS: ${requirements ?? 'N/A'}

PARSED RESUME: ${JSON.stringify(parsedResume).slice(0, 6000)}`;
    return this.tryAi(prompt, () =>
      this.mockScore(parsedResume, description, requirements),
    );
  }

  // ---------- candidate summary ----------

  summarizeCandidate(
    parsedResume: unknown,
    jobTitle: string,
    jobRequirements?: string | null,
  ): Promise<CandidateInsights> {
    const prompt = `Write a structured recruiter-facing analysis of this candidate for
the role "${jobTitle}". Respond with ONLY valid JSON:
{"summary":"3-4 sentence assessment","key_skills":["strongest relevant skills, max 6"],"relevant_experience":"1-2 sentences on applicable work history","strengths":["potential strengths, max 4"],"missing_requirements":["gaps vs the posting, max 4"],"interview_areas":["topics worth probing, max 4"]}

JOB REQUIREMENTS: ${jobRequirements ?? 'not specified'}
PARSED RESUME: ${JSON.stringify(parsedResume).slice(0, 6000)}`;
    return this.tryAi(prompt, () => {
      const resume = parsedResume as ParsedResume;
      const skills = resume?.skills ?? [];
      const jobSkills = this.foundSkills(
        `${jobTitle} ${jobRequirements ?? ''}`,
      );
      const missing = jobSkills.filter(
        (s) => !skills.map((x) => x.toLowerCase()).includes(s),
      );
      return {
        summary: `Candidate profile lists ${skills.length} skills including ${skills.slice(0, 4).join(', ') || 'none detected'}. Review the parsed resume for details. (Mock summary — set OPENAI_API_KEY for real AI summaries.)`,
        key_skills: skills.slice(0, 6),
        relevant_experience: 'See parsed experience section for details.',
        strengths: skills.slice(0, 4),
        missing_requirements: missing.slice(0, 4),
        interview_areas: missing
          .slice(0, 2)
          .map((s) => `Depth of ${s} experience`),
      };
    });
  }

  // ---------- interview question generation ----------

  generateInterviewQuestions(
    parsedResume: unknown,
    title: string,
    description: string,
  ): Promise<QuestionBank> {
    const prompt = `Generate interview questions for a "${title}" role tailored to this
candidate. Respond with ONLY valid JSON — 2-3 questions per category:
{"technical":["..."],"behavioral":["..."],"project_based":["..."],"role_specific":["..."],"situational":["..."]}
Probe skills the job needs but the resume may lack.

JOB DESCRIPTION: ${description.slice(0, 4000)}
PARSED RESUME: ${JSON.stringify(parsedResume).slice(0, 4000)}`;
    return this.tryAi(prompt, () => {
      const jobSkills = this.foundSkills(`${title} ${description}`);
      return {
        technical: [
          `Walk me through your experience with ${jobSkills[0] ?? 'the core stack'} — what did you build?`,
          `How do you approach testing and code quality?`,
        ],
        behavioral: [
          'Describe a difficult technical problem you solved recently.',
          'Tell me about a time you had to learn a new technology quickly.',
        ],
        project_based: [
          'Pick a project from your resume — what would you do differently today?',
        ],
        role_specific: [
          `This role uses ${jobSkills.slice(0, 3).join(', ') || 'our stack'} — which are you strongest and weakest in?`,
        ],
        situational: [
          'A deploy breaks production at 5pm Friday — walk me through your first hour.',
        ],
      };
    });
  }

  // ---------- job description analysis ----------

  analyzeJobDescription(
    title: string,
    description: string,
  ): Promise<Record<string, unknown>> {
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
    const email = rawText.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0];
    const phone = rawText.match(/(\+?\d[\d\-() ]{6,}\d)/)?.[1]?.trim();
    return {
      name: firstLine.slice(0, 80),
      ...(email ? { email } : {}),
      ...(phone ? { phone: phone.slice(0, 20) } : {}),
      summary: firstLine.slice(0, 300) || 'No summary extracted',
      skills: this.foundSkills(rawText),
      experience: [],
      education: [],
      certifications: [],
      projects: [],
    };
  }

  private mockScore(
    parsedResume: unknown,
    description: string,
    requirements?: string | null,
  ): MatchResult {
    const jobSkills = new Set(
      this.foundSkills(`${description} ${requirements ?? ''}`),
    );
    const resumeSkills = new Set(
      ((parsedResume as ParsedResume)?.skills ?? []).map((s) =>
        s.toLowerCase(),
      ),
    );
    const matched = [...jobSkills].filter((s) => resumeSkills.has(s)).sort();
    const missing = [...jobSkills].filter((s) => !resumeSkills.has(s)).sort();
    const score = jobSkills.size
      ? Math.round((100 * matched.length) / jobSkills.size)
      : 50;
    const band = (s: number) =>
      s >= 70
        ? ('STRONG' as const)
        : s >= 40
          ? ('PARTIAL' as const)
          : ('WEAK' as const);
    const hasEducation =
      Array.isArray((parsedResume as ParsedResume)?.education) &&
      ((parsedResume as ParsedResume).education?.length ?? 0) > 0;
    return {
      score,
      matched_skills: matched,
      missing_skills: missing,
      experience_match: band(score),
      education_match: hasEducation ? band(score) : 'UNKNOWN',
      explanation: `Heuristic match: candidate has ${matched.length} of ${jobSkills.size} skills mentioned in the job posting.`,
    };
  }
}
