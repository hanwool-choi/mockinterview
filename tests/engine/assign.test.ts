import { describe, it, expect } from 'vitest';
import { assignInterviewers, followUpLimit } from '../../src/engine/assign';
import { iv } from './fixtures';

describe('assignInterviewers', () => {
  const panel = [iv('dev', 'dev', 'staff'), iv('hr', 'hr', 'lead')];
  it('routes stages per spec table', () => {
    expect(assignInterviewers('experience', panel)).toBe('dev');
    expect(assignInterviewers('competency', panel)).toBe('dev');
    expect(assignInterviewers('motivation', panel)).toBe('hr');
    expect(assignInterviewers('situational', panel)).toBe('hr');
    expect(assignInterviewers('intro', panel)).toBe('hr');
  });
  it('falls back to most senior when no HR exists', () => {
    const p = [iv('d1', 'dev', 'staff'), iv('x', 'sales', 'exec')];
    expect(assignInterviewers('motivation', p)).toBe('x');
    expect(assignInterviewers('company', p)).toBe('x');
  });
  it('a single interviewer asks everything', () => {
    const p = [iv('solo', 'hr', 'manager')];
    for (const s of ['intro', 'experience', 'closing'] as const) expect(assignInterviewers(s, p)).toBe('solo');
  });
  it('practitioner = lowest-ranked non-HR', () => {
    const p = [iv('lead', 'dev', 'lead'), iv('jr', 'design', 'staff'), iv('hr', 'hr', 'staff')];
    expect(assignInterviewers('experience', p)).toBe('jr');
  });
});

describe('followUpLimit', () => {
  it('pressure gets 2, others 1', () => {
    expect(followUpLimit('pressure')).toBe(2);
    expect(followUpLimit('warm')).toBe(1);
    expect(followUpLimit('strict')).toBe(1);
  });
});
