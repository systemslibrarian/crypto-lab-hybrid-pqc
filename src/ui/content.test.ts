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

  it('labels the deployed X25519MLKEM768 group as final RFC 10024', () => {
    const tlsCard = [...section.querySelectorAll('.deploy-card')].find((card) => card.textContent?.includes('X25519MLKEM768'));
    expect(tlsCard?.textContent).toContain('IETF RFC 10024 (final)');
    expect(tlsCard?.querySelector('a.ref-link')?.getAttribute('href')).toBe('https://www.rfc-editor.org/rfc/rfc10024.html');
    const standard = [...section.querySelectorAll('.standards li')].find((item) => item.textContent?.includes('RFC 10024'));
    expect(standard?.textContent).toContain('Final (August 2026)');
  });
});
