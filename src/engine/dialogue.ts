import type { Lang, Plan } from '../../shared/schema';
import { tokenize } from '../docs/bm25';

/** Token-set Jaccard similarity (Hangul bigrams + latin words). */
export function similarity(a: string, b: string): number {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

const ACKS: Record<Lang, { strong: string[]; mid: string[]; weak: string[] }> = {
  ko: {
    strong: ['좋습니다. 구체적이네요.', '네, 명확하게 정리해 주셨네요.', '좋네요. 수치까지 짚어 주셨고요.'],
    mid: ['네, 알겠습니다.', '그렇군요.', '네, 말씀 잘 들었습니다.'],
    weak: ['음, 알겠습니다.', '그렇군요. 조금 더 여쭤볼게요.', '음, 그렇군요.'],
  },
  en: {
    strong: ['Good, that was specific.', 'Clear, thank you.', 'Good, and you gave numbers.'],
    mid: ['I see.', 'Okay, got it.', 'Thank you.'],
    weak: ['Hmm, I see.', 'Okay. Let me dig a little.', 'I see.'],
  },
};

/** A back-channel line that matches how the answer actually landed. */
export function ackFor(score: number, lang: Lang, seed: number): string {
  const band = score >= 80 ? 'strong' : score >= 60 ? 'mid' : 'weak';
  const xs = ACKS[lang][band];
  return xs[Math.abs(seed) % xs.length];
}

/** First candidate not already asked (exactly or near-identically). */
export function chooseFollowUp(candidates: string[], used: Set<string>): string | null {
  for (const c of candidates) {
    if (!c?.trim()) continue;
    if ([...used].some((u) => u === c || similarity(u, c) >= 0.45)) continue;
    return c;
  }
  return null;
}

/** Replace near-duplicate questions with unused template questions of the same stage. */
export function dedupeQuestions(plan: Plan, template: Plan, threshold = 0.6): Plan {
  const kept: Plan['questions'] = [];
  for (const q of plan.questions) {
    const dup = kept.some((k) => similarity(k.text, q.text) >= threshold);
    if (!dup) {
      kept.push(q);
      continue;
    }
    const alt = template.questions.find((t) => t.stage === q.stage && !kept.some((k) => similarity(k.text, t.text) >= threshold));
    kept.push(alt ? { ...alt, id: `${q.id}-alt`, askedBy: q.askedBy } : q);
  }
  return { ...plan, questions: kept };
}

/** Keep follow-ups fresh: no repeats of earlier follow-ups, no overlap with questions still to come. */
export function sanitizeFollowUp<S extends { followUp: { needed: boolean; askedBy: string; text: string } | null }>(
  score: S,
  question: { followUpSeeds: string[] },
  used: Set<string>,
  upcoming: string[],
): S {
  const fu = score.followUp;
  if (!fu?.needed || !fu.text) return score;
  const clashes = (t: string) => upcoming.some((u) => similarity(u, t) >= 0.5);
  const pick = chooseFollowUp([fu.text, ...question.followUpSeeds].filter((t) => !clashes(t)), used);
  return { ...score, followUp: pick ? { ...fu, text: pick } : null };
}
