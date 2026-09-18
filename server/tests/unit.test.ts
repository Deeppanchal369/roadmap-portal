import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canTransition } from '../src/models/Post.js';
import { slugify } from '../src/utils/slug.js';
import { trendingScore } from '../src/utils/trending.js';
import { createPostSchema, listPostsQuerySchema } from '../src/modules/posts/posts.validation.js';
import { registerSchema } from '../src/modules/auth/auth.validation.js';

describe('trending score', () => {
  it('ranks a fresh post above an older one with the same votes', () => {
    assert.ok(trendingScore(10, 0, 1) > trendingScore(10, 0, 100));
  });

  it('lets a much older post win if it has far more votes', () => {
    assert.ok(trendingScore(500, 0, 72) > trendingScore(2, 0, 1));
  });

  it('counts comments as half a vote', () => {
    assert.equal(trendingScore(10, 2, 5), trendingScore(11, 0, 5));
  });

  it('never divides by zero for a post created this instant', () => {
    assert.ok(Number.isFinite(trendingScore(0, 0, 0)));
  });
});

describe('status transitions', () => {
  it('allows the documented forward path', () => {
    assert.ok(canTransition('under_review', 'planned'));
    assert.ok(canTransition('planned', 'in_progress'));
    assert.ok(canTransition('in_progress', 'completed'));
  });

  it('refuses to jump straight from review to completed', () => {
    assert.equal(canTransition('under_review', 'completed'), false);
  });

  it('allows one step back but not a full reset from completed', () => {
    assert.ok(canTransition('completed', 'in_progress'));
    assert.equal(canTransition('completed', 'under_review'), false);
  });
});

describe('slugify', () => {
  it('produces a url-safe slug', () => {
    assert.match(slugify('Add  Slack & Jira  sync!'), /^add-slack-jira-sync-[a-f\d]{6}$/);
  });

  it('never collides for identical titles', () => {
    assert.notEqual(slugify('Dark mode'), slugify('Dark mode'));
  });

  it('falls back when a title has no usable characters', () => {
    assert.match(slugify('!!!'), /^request-[a-f\d]{6}$/);
  });
});

describe('validation', () => {
  it('rejects a short title', () => {
    const result = createPostSchema.safeParse({ title: 'Hi', description: 'long enough here', category: 'general' });
    assert.equal(result.success, false);
  });

  it('rejects an unknown category', () => {
    const result = createPostSchema.safeParse({ title: 'A good title', description: 'long enough here', category: 'nope' });
    assert.equal(result.success, false);
  });

  it('requires a mixed-case password with a digit', () => {
    assert.equal(registerSchema.safeParse({ name: 'Ana', email: 'a@b.com', password: 'alllowercase' }).success, false);
    assert.equal(registerSchema.safeParse({ name: 'Ana', email: 'a@b.com', password: 'Str0ngPass' }).success, true);
  });

  it('coerces and caps pagination', () => {
    const parsed = listPostsQuerySchema.parse({ page: '3', limit: '12' });
    assert.equal(parsed.page, 3);
    assert.equal(parsed.limit, 12);
    assert.equal(listPostsQuerySchema.safeParse({ limit: '500' }).success, false);
  });

  it('applies defaults when the query is empty', () => {
    const parsed = listPostsQuerySchema.parse({});
    assert.equal(parsed.page, 1);
    assert.equal(parsed.limit, 12);
  });
});
