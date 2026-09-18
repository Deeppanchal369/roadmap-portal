/**
 * Populates an empty database with enough content to exercise every screen:
 * sorting, pagination, all four statuses, threaded replies and existing votes.
 *
 * Safe to re-run — it clears the four collections first. Never point it at a
 * database you care about.
 */
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { env } from '../config/env.js';
import { Comment } from '../models/Comment.js';
import { Post, type PostCategory, type PostStatus } from '../models/Post.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { User } from '../models/User.js';

const DEMO_PASSWORD = 'Password@123';

const people = [
  { name: 'Ana Duarte', email: 'ana@roadmap.test' },
  { name: 'Marcus Webb', email: 'marcus@roadmap.test' },
  { name: 'Priya Raman', email: 'priya@roadmap.test' },
  { name: 'Tomas Berg', email: 'tomas@roadmap.test' },
  { name: 'Leila Haddad', email: 'leila@roadmap.test' },
];

const requests: Array<{
  title: string;
  description: string;
  category: PostCategory;
  status: PostStatus;
  ageHours: number;
}> = [
  {
    title: 'Keyboard shortcuts for the whole board',
    description:
      'Moving cards with a mouse slows down triage.\n\nA small set would cover most of it:\n\n- `j` / `k` to move between cards\n- `1`–`4` to set status\n- `/` to focus search\n\nHappy to help test this.',
    category: 'ui-ux',
    status: 'planned',
    ageHours: 30,
  },
  {
    title: 'Slack notification when a request ships',
    description:
      'We tell customers something is planned and then forget to tell them it shipped. A webhook to a Slack channel on every move to **Completed** would close that loop.',
    category: 'integrations',
    status: 'in_progress',
    ageHours: 96,
  },
  {
    title: 'Feed takes six seconds on large boards',
    description:
      'Once a board passes ~2,000 requests the first paint is painfully slow. It looks like every vote array is being sent to the browser.\n\nCould the vote count be aggregated server side instead?',
    category: 'performance',
    status: 'completed',
    ageHours: 400,
  },
  {
    title: 'Let people search their own past requests',
    description: 'There is no way to find something I posted three months ago without scrolling the whole feed.',
    category: 'general',
    status: 'under_review',
    ageHours: 3,
  },
  {
    title: 'Dark mode that follows the system setting',
    description:
      'A manual toggle is fine, but it should default to whatever the operating system is already using instead of flashing white on every visit.',
    category: 'ui-ux',
    status: 'in_progress',
    ageHours: 52,
  },
  {
    title: 'Export the roadmap as CSV',
    description: 'Our leadership deck is built in a spreadsheet. Copying twenty rows by hand every month is not sustainable.',
    category: 'integrations',
    status: 'planned',
    ageHours: 140,
  },
  {
    title: 'Merge duplicate requests and keep both vote counts',
    description:
      'The same idea gets posted three or four times. Merging should move the votes and the comments onto the surviving request so nobody loses their voice.',
    category: 'general',
    status: 'under_review',
    ageHours: 12,
  },
  {
    title: 'Email digest of new requests each week',
    description: 'A Monday summary of what was posted and what moved would save me opening the board daily.',
    category: 'general',
    status: 'under_review',
    ageHours: 8,
  },
  {
    title: 'Jira sync for anything marked In progress',
    description: 'Our engineers live in Jira. Two-way status sync would stop the two boards drifting apart within a week.',
    category: 'integrations',
    status: 'under_review',
    ageHours: 60,
  },
  {
    title: 'Show who voted on a request',
    description:
      'When a request comes from twelve enterprise accounts that matters more than twelve individuals. Admins should be able to see the list.',
    category: 'general',
    status: 'planned',
    ageHours: 200,
  },
  {
    title: 'Markdown preview while writing a request',
    description: 'I keep posting broken lists because there is no way to see the formatting before submitting.',
    category: 'ui-ux',
    status: 'completed',
    ageHours: 520,
  },
  {
    title: 'Rate limit the vote endpoint',
    description: 'A script could inflate a request to the top of the board in seconds. Some throttling would help.',
    category: 'performance',
    status: 'completed',
    ageHours: 700,
  },
  {
    title: 'Mobile layout breaks on the roadmap board',
    description: 'The three columns squeeze into an unreadable strip on a phone. Stacking them would be enough.',
    category: 'ui-ux',
    status: 'under_review',
    ageHours: 20,
  },
  {
    title: 'Let admins pin one request to the top',
    description: 'During a launch we want everyone to see the same announcement first.',
    category: 'general',
    status: 'under_review',
    ageHours: 5,
  },
];

const commentSeeds = [
  'This would save my team an hour a week, easily.',
  'We work around it with a spreadsheet right now, which nobody enjoys.',
  'Same problem here. Happy to share what our workflow looks like if that helps.',
  'Any chance this lands before the end of the quarter?',
  'Worth splitting this into two requests — the second half feels separate.',
];

const replySeeds = [
  'Agreed, the second half is really its own thing.',
  'We have this on the list. No date yet, but it is being scoped.',
  'Could you share the workaround? We might use it in the meantime.',
];

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);
const pick = <T>(list: T[], n: number): T[] => [...list].sort(() => Math.random() - 0.5).slice(0, n);

async function seed() {
  await connectDatabase();
  console.log('[seed] clearing existing data');
  await Promise.all([
    User.deleteMany({}),
    Post.deleteMany({}),
    Comment.deleteMany({}),
    RefreshToken.deleteMany({}),
  ]);

  const passwordHash = await User.hashPassword(DEMO_PASSWORD);
  const adminHash = await User.hashPassword(env.SEED_ADMIN_PASSWORD);
  const avatar = (name: string) =>
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;

  const admin = await User.create({
    name: 'Roadmap Admin',
    email: env.SEED_ADMIN_EMAIL,
    passwordHash: adminHash,
    role: 'admin',
    isEmailVerified: true,
    avatarUrl: avatar('Roadmap Admin'),
  });

  const users = await User.insertMany(
    people.map((person) => ({
      ...person,
      passwordHash,
      role: 'user' as const,
      isEmailVerified: true,
      avatarUrl: avatar(person.name),
    })),
  );

  console.log(`[seed] created ${users.length + 1} users`);

  let commentTotal = 0;

  for (const request of requests) {
    const author = users[Math.floor(Math.random() * users.length)]!;
    const voters = pick(users, Math.floor(Math.random() * users.length) + 1).map((u) => u._id);
    const createdAt = hoursAgo(request.ageHours);

    const post = await Post.create({
      title: request.title,
      description: request.description,
      category: request.category,
      status: request.status,
      author: author._id,
      voters,
      voteCount: voters.length,
      createdAt,
      updatedAt: createdAt,
      statusHistory:
        request.status === 'under_review'
          ? []
          : [
              {
                from: 'under_review',
                to: request.status,
                changedBy: admin._id,
                note: 'Triaged during roadmap review',
                changedAt: hoursAgo(Math.max(1, request.ageHours - 12)),
              },
            ],
    });

    const roots = pick(commentSeeds, Math.floor(Math.random() * 3));
    for (const body of roots) {
      const commenter = users[Math.floor(Math.random() * users.length)]!;
      const root = await Comment.create({
        post: post._id,
        author: commenter._id,
        body,
        depth: 0,
        createdAt: hoursAgo(Math.max(0, request.ageHours - 4)),
      });
      commentTotal += 1;

      if (Math.random() > 0.5) {
        await Comment.create({
          post: post._id,
          author: admin._id,
          parent: root._id,
          depth: 1,
          body: replySeeds[Math.floor(Math.random() * replySeeds.length)]!,
          createdAt: hoursAgo(Math.max(0, request.ageHours - 2)),
        });
        commentTotal += 1;
      }
    }

    await Post.updateOne(
      { _id: post._id },
      { $set: { commentCount: await Comment.countDocuments({ post: post._id }) } },
    );
  }

  console.log(`[seed] created ${requests.length} requests and ${commentTotal} comments`);
  console.log('');
  console.log('  Admin    ', env.SEED_ADMIN_EMAIL, '/', env.SEED_ADMIN_PASSWORD);
  console.log('  Member   ', people[0]!.email, '/', DEMO_PASSWORD);
  console.log('');

  await disconnectDatabase();
}

seed()
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error('[seed] failed:', error);
    await mongoose.connection.close().catch(() => undefined);
    process.exit(1);
  });
