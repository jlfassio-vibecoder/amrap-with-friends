import { describe, it, expect } from 'vitest';
import { SITE_ORIGIN } from '@/lib/seo/routes';
import {
  breadcrumbList,
  faqPage,
  organization,
  serializeJsonLd,
  webApplication,
} from '@/lib/seo/structuredData';

describe('structured data', () => {
  it('gives the organization a stable @id the other nodes reference', () => {
    expect(organization()['@id']).toBe(`${SITE_ORIGIN}/#organization`);
    expect(webApplication().publisher).toEqual({ '@id': `${SITE_ORIGIN}/#organization` });
  });

  it('numbers breadcrumb positions from one and absolutises each path', () => {
    const crumbs = breadcrumbList([
      { name: 'Home', path: '/' },
      { name: 'AMRAP timer', path: '/amrap-timer' },
    ]);
    expect(crumbs.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_ORIGIN}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'AMRAP timer',
        item: `${SITE_ORIGIN}/amrap-timer`,
      },
    ]);
  });

  it('wraps each FAQ entry as a Question with an accepted Answer', () => {
    const faq = faqPage([{ question: 'What is an AMRAP?', answer: 'As many rounds as possible.' }]);
    expect(faq.mainEntity).toEqual([
      {
        '@type': 'Question',
        name: 'What is an AMRAP?',
        acceptedAnswer: { '@type': 'Answer', text: 'As many rounds as possible.' },
      },
    ]);
  });
});

describe('serializeJsonLd', () => {
  it('escapes < so a string cannot close the script tag early', () => {
    const json = serializeJsonLd({ name: '</script><img onerror=alert(1)>' });
    expect(json).not.toContain('</script>');
    expect(json).toContain('\\u003c/script');
  });

  it('serialises an array of nodes', () => {
    expect(serializeJsonLd([organization(), webApplication()])).toContain('WebApplication');
  });
});
