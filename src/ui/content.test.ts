// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { buildRealWorld } from './content.ts';
import { DEPLOYMENTS, STANDARDS } from '../data.ts';

describe('real-world section citations', () => {
  const section = buildRealWorld();

  it('every deployment and standard carries a source link', () => {
    const links = [...section.querySelectorAll('a.ref-link')] as HTMLAnchorElement[];
    expect(links.length).toBe(DEPLOYMENTS.length + STANDARDS.length);
    for (const a of links) {
      expect(a.getAttribute('href')).toMatch(/^https:\/\//);
      expect(a.getAttribute('rel')).toBe('noopener');
      expect(a.getAttribute('target')).toBe('_blank');
    }
  });

  it('cites primary sources (IETF, NIST, Signal, Apple)', () => {
    const hrefs = [...section.querySelectorAll('a.ref-link')].map((a) => a.getAttribute('href') ?? '');
    expect(hrefs.some((h) => h.includes('datatracker.ietf.org'))).toBe(true);
    expect(hrefs.some((h) => h.includes('csrc.nist.gov'))).toBe(true);
    expect(hrefs.some((h) => h.includes('signal.org'))).toBe(true);
    expect(hrefs.some((h) => h.includes('security.apple.com'))).toBe(true);
  });
});
