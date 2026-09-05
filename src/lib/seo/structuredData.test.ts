import { describe, it, expect } from 'vitest';
import { SITE_ORIGIN } from '@/lib/seo/routes';
import {
  blogPosting,
  breadcrumbList,
  exercisePlan,
  faqPage,
  howTo,
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

describe('howTo', () => {
  it('numbers steps from one and absolutises the url', () => {
    const node = howTo({
      name: 'Burpees',
      description: 'How to do burpees.',
      steps: [
        { name: 'Setup', text: 'Drop into a squat.' },
        { name: 'Cue', text: 'Drop fast, snap up faster.' },
      ],
      path: '/exercises/burpees',
    });
    expect(node.url).toBe(`${SITE_ORIGIN}/exercises/burpees`);
    expect(node.step).toEqual([
      { '@type': 'HowToStep', position: 1, name: 'Setup', text: 'Drop into a squat.' },
      { '@type': 'HowToStep', position: 2, name: 'Cue', text: 'Drop fast, snap up faster.' },
    ]);
  });

  it('omits image entirely when there is none, rather than emitting an empty one', () => {
    const node = howTo({
      name: 'Burpees',
      description: 'd',
      steps: [],
      path: '/exercises/burpees',
    });
    expect('image' in node).toBe(false);
  });

  it('carries the image when one resolved', () => {
    const node = howTo({
      name: 'Burpees',
      description: 'd',
      steps: [],
      path: '/exercises/burpees',
      image: 'https://project.supabase.co/storage/v1/object/public/exercise-media/burpees/s.jpeg',
    });
    expect(node.image).toContain('/exercise-media/burpees/s.jpeg');
  });
});

describe('exercisePlan', () => {
  it('writes the time cap as an ISO 8601 duration', () => {
    const node = exercisePlan({
      name: 'The Piston',
      description: 'A five minute AMRAP.',
      durationMinutes: 5,
      movements: ['10 Air Squats', '10 Hand-Release Push-ups'],
      path: '/amrap-workouts/5-minute/the-piston',
    });
    expect(node.activityDuration).toBe('PT5M');
    expect(node.workload).toBe('10 Air Squats, 10 Hand-Release Push-ups');
    expect(node.exerciseType).toBe('AMRAP');
  });
});

describe('blogPosting', () => {
  it('uses snapshot dates and author name, never inventing a clock', () => {
    const node = blogPosting({
      title: 'Why easy days matter',
      description: 'A short take.',
      path: '/blog/why-easy-days-matter',
      authorName: 'Coach',
      datePublished: '2026-01-01T00:00:00.000Z',
      dateModified: '2026-09-05T12:00:00.000Z',
      image: 'https://example.com/og.png',
    });
    expect(node['@type']).toBe('BlogPosting');
    expect(node.url).toBe(`${SITE_ORIGIN}/blog/why-easy-days-matter`);
    expect(node.datePublished).toBe('2026-01-01T00:00:00.000Z');
    expect(node.dateModified).toBe('2026-09-05T12:00:00.000Z');
    expect(node.author).toEqual({ '@type': 'Person', name: 'Coach' });
    expect(node.image).toBe('https://example.com/og.png');
  });

  it('omits image when none is provided', () => {
    const node = blogPosting({
      title: 'T',
      description: 'D',
      path: '/blog/t',
      authorName: 'A',
      datePublished: '2026-01-01T00:00:00.000Z',
      dateModified: '2026-01-01T00:00:00.000Z',
    });
    expect('image' in node).toBe(false);
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
