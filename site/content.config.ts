import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/** YAML may coerce ISO timestamps to Date; keep snapshot strings for JSON-LD/RSS. */
const isoTimestamp = z.preprocess(
  (value) => (value instanceof Date ? value.toISOString() : value),
  z.string()
);

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './site/content/blog' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    description: z.string(),
    answerFirst: z.string(),
    author: z.string(),
    category: z.string(),
    archetype: z.string(),
    pillar: z.string(),
    libraryLinks: z.array(z.string()).default([]),
    relatedPosts: z.array(z.string()).default([]),
    photos: z
      .array(
        z.object({
          src: z.string(),
          alt: z.string(),
          caption: z.string().optional(),
        })
      )
      .default([]),
    publishedAt: isoTimestamp,
    modifiedAt: isoTimestamp,
  }),
});

export const collections = { blog };
