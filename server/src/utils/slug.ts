import crypto from 'node:crypto';

/** URL-safe slug with a short random suffix so two identical titles cannot collide. */
export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${base || 'request'}-${suffix}`;
}
