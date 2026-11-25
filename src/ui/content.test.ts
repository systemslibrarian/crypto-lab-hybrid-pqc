// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { buildProtocolFidelity, buildRealWorld } from './content.ts';
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
    expect(hrefs.some((h) => h.includes('rfc-editor.org'))).toBe(true);
    expect(hrefs.some((h) => h.includes('csrc.nist.gov'))).toBe(true);
    expect(hrefs.some((h) => h.includes('signal.org'))).toBe(true);
    expect(hrefs.some((h) => h.includes('security.apple.com'))).toBe(true);
  });

  it('names Kyber, not ML-KEM, for PQXDH and PQ3', () => {
    // Both protocols predate FIPS 203 and both published designs say Kyber.
    // The PQXDH specification (Revision 3, last updated 2024-01-23) defines
    // its pqkem with the example "Crystals-Kyber-1024" and never mentions
    // ML-KEM; Apple's PQ3 announcement (21 February 2024) registers "a
    // post-quantum Kyber-1024 key encapsulation public key" and instantiates
    // the ratchet KEM with Kyber-768. Read at both sources on 2026-11-15.
    const card = (system: string) =>
      [...section.querySelectorAll('.deploy-card')].find((c) => c.textContent?.includes(system));
    const signal = card('PQXDH');
    expect(signal?.textContent).toContain('CRYSTALS-Kyber-1024');
    expect(signal?.textContent).not.toContain('ML-KEM-1024');
    const apple = card('PQ3');
    expect(apple?.textContent).toContain('Kyber-1024');
    expect(apple?.textContent).not.toMatch(/PQ3 \(ECDH \+ ML-KEM/);
  });

  it('separates deployed X25519MLKEM768 support from the final standard', () => {
    const tlsCard = [...section.querySelectorAll('.deploy-card')].find((card) => card.textContent?.includes('X25519MLKEM768'));
    expect(tlsCard?.textContent).toContain('negotiate to confirm');
    expect(tlsCard?.textContent).toContain('depends on both endpoints');
    expect(tlsCard?.querySelector('a.ref-link')?.getAttribute('href')).toBe('https://developers.cloudflare.com/ssl/post-quantum-cryptography/pqc-support/');
    const standard = [...section.querySelectorAll('.standards li')].find((item) => item.textContent?.includes('RFC 10024'));
    expect(standard?.textContent).toContain('Standards Track RFC (August 2026)');
  });

  it('does not infer the negotiated protocol from merely loading the lesson', () => {
    expect(section.textContent).toContain('must be measured rather than assumed');
    expect(section.textContent).not.toContain('protocols you used to load this page');
  });
});

it('attributes the hybrid secret order to RFC 10024 before the TLS key schedule', () => {
  const section = buildProtocolFidelity();
  const tls = [...section.querySelectorAll('tbody tr')].find((row) =>
    row.textContent?.includes('X25519MLKEM768'),
  );
  expect(tls?.textContent).toContain('RFC 10024 §4.3 fixes the two-secret order');
  expect(tls?.textContent).toContain('RFC 9846 §7.1');
});

it('renders final KEM guidance and the separate Informational hybrid RFC',()=>{
 const section=buildRealWorld();
 for(const [id,url,label] of [
 ['NIST SP 800-227','https://csrc.nist.gov/pubs/sp/800/227/final','Final NIST (2025-09-18)'],
 ['RFC 9954','https://www.rfc-editor.org/rfc/rfc9954.html','Informational RFC (July 2026)']]) {
  const row=[...section.querySelectorAll('.standards li')].find(x=>x.textContent?.includes(id));
  expect(row?.textContent).toContain(label);
  expect(row?.querySelector('a')?.getAttribute('href')).toBe(url);
  expect(STANDARDS.find(x=>x.id===id)?.verified).toBe('2026-10-12');
 }
});
