/**
 * Development seed script.
 *
 * Populates the database with a small but realistic social graph so the app has
 * something to show the moment it starts: a feed with posts at all three
 * visibility levels, accepted friendships, pending friend requests waiting on
 * the Requests page, and comment threads.
 *
 * Run with:  npm run seed
 *
 * Every account uses the same password: Password1!
 *
 * Design notes
 * ------------
 * - DESTRUCTIVE. It truncates every table before inserting, so the data is the
 *   same on every run and demos are reproducible. It refuses to run when
 *   NODE_ENV is 'production'.
 * - Wrapped in a single transaction on one dedicated client. Either the whole
 *   graph lands or none of it does, so a failure halfway through can't leave a
 *   half-built database behind.
 * - Timestamps are backdated by varying amounts. Without this every post shares
 *   one created_at, the feed's ORDER BY created_at DESC has nothing to sort on,
 *   and the ordering comes out arbitrary.
 * - Passwords are hashed with the same bcrypt cost the app uses, so seeded
 *   accounts log in through the normal flow rather than a special path.
 */

import bcrypt from 'bcrypt';

import { pool } from '../config/database.js';

const PASSWORD = 'Password1!';
const BCRYPT_ROUNDS = 12;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Helper: a timestamp `ms` milliseconds in the past.
const ago = (ms) => new Date(Date.now() - ms);

const USERS = [
  {
    username: 'almog',
    email: 'almog@bestiz.dev',
    displayName: 'Almog Meirov',
    bio: 'CS student. Building things that talk to each other in real time.',
  },
  {
    username: 'maya_l',
    email: 'maya@bestiz.dev',
    displayName: 'Maya Levi',
    bio: 'Backend engineer. Postgres apologist.',
  },
  {
    username: 'noam_dev',
    email: 'noam@bestiz.dev',
    displayName: 'Noam Barak',
    bio: 'Frontend, design systems, too much coffee.',
  },
  {
    username: 'tal_r',
    email: 'tal@bestiz.dev',
    displayName: 'Tal Rosen',
    bio: 'Data. Mostly cleaning it.',
  },
  {
    username: 'yael_k',
    email: 'yael@bestiz.dev',
    displayName: 'Yael Cohen',
    bio: 'Product. Asking why until someone cries.',
  },
  {
    username: 'idan_s',
    email: 'idan@bestiz.dev',
    displayName: 'Idan Shalev',
    bio: 'DevOps. It works on my cluster.',
  },
];

/**
 * The social graph.
 *
 * `accepted` pairs are mutual friends; `pending` pairs are open requests that
 * show up on the addressee's Requests page. Note that almog is the addressee on
 * two pending requests, so logging in as almog lands on a Requests page with
 * something in it rather than an empty state.
 */
const FRIENDSHIPS = [
  { requester: 'almog', addressee: 'maya_l', status: 'accepted' },
  { requester: 'almog', addressee: 'noam_dev', status: 'accepted' },
  { requester: 'tal_r', addressee: 'almog', status: 'accepted' },
  { requester: 'maya_l', addressee: 'noam_dev', status: 'accepted' },
  { requester: 'maya_l', addressee: 'tal_r', status: 'accepted' },
  { requester: 'noam_dev', addressee: 'idan_s', status: 'accepted' },

  // Open requests waiting for a decision.
  { requester: 'yael_k', addressee: 'almog', status: 'pending' },
  { requester: 'idan_s', addressee: 'almog', status: 'pending' },
  { requester: 'noam_dev', addressee: 'yael_k', status: 'pending' },
  { requester: 'tal_r', addressee: 'yael_k', status: 'pending' },
];

/**
 * Posts across all three visibility levels.
 *
 * The mix matters: logged out or as a stranger you should see only `public`
 * posts, as a friend you should also see `friends` posts, and `private` posts
 * should be visible to nobody but their author. That makes the seed a live
 * demonstration of the visibility rules, not just filler text.
 */
const POSTS = [
  {
    author: 'almog',
    content:
      'Shipped the token refresh flow tonight. Access tokens expire after 15 minutes and the client swaps them out silently, so nobody gets logged out mid-scroll.',
    visibility: 'public',
    age: 40 * MINUTE,
  },
  {
    author: 'maya_l',
    content:
      'Reminder that a unique index on LEAST(a, b), GREATEST(a, b) is the cleanest way to stop duplicate friendships. No triggers, no application-level locking.',
    visibility: 'public',
    age: 2 * HOUR,
  },
  {
    author: 'noam_dev',
    content:
      'Spent an hour on a bug that only happened in CI. Turned out the filename was PostCard.module.css locally and Postcard.module.css in git. Linux does not forgive.',
    visibility: 'public',
    age: 5 * HOUR,
  },
  {
    author: 'tal_r',
    content: 'Bryggen in Bergen at dusk. Worth the early flight.',
    visibility: 'public',
    image_url:
      'https://images.unsplash.com/photo-1544085311-11a028465b03?w=800',
    age: 8 * HOUR,
  },
  {
    author: 'maya_l',
    content:
      'Friends-only: interviewing at two places next month. Nervous but the prep is going well.',
    visibility: 'friends',
    age: 12 * HOUR,
  },
  {
    author: 'almog',
    content:
      'Friends-only: the portfolio project finally has a test suite. 50 green. Sleeping better already.',
    visibility: 'friends',
    age: 1 * DAY,
  },
  {
    author: 'noam_dev',
    content:
      'Friends-only: anyone got a recommendation for a decent mechanical keyboard under 400?',
    visibility: 'friends',
    age: 1 * DAY + 6 * HOUR,
  },
  {
    author: 'almog',
    content:
      'Private note to self: refactor the socket auth to re-handshake after a token refresh.',
    visibility: 'private',
    age: 2 * DAY,
  },
  {
    author: 'yael_k',
    content:
      'Private: draft of the Q4 roadmap. Not sharing until the numbers are in.',
    visibility: 'private',
    age: 2 * DAY + 3 * HOUR,
  },
  {
    author: 'idan_s',
    content:
      'Public service announcement: npm ci, not npm install, in your CI pipeline. Your future self will thank you.',
    visibility: 'public',
    age: 3 * DAY,
  },
  {
    author: 'yael_k',
    content:
      'New here. Building a social app for a course project and this one is a nice reference.',
    visibility: 'public',
    age: 4 * DAY,
  },
  {
    author: 'tal_r',
    content:
      'Hot take: most dashboards would be better as a single well-chosen number.',
    visibility: 'public',
    age: 5 * DAY,
  },
];

/**
 * Comments, keyed by the index of the post in POSTS above.
 * Kept on public posts so the threads are visible to any viewer.
 */
const COMMENTS = [
  { post: 0, author: 'maya_l', content: 'Single-flight on the refresh call, I hope? Otherwise five requests means five refreshes.', age: 30 * MINUTE },
  { post: 0, author: 'almog', content: 'Yep. One shared promise, everyone waits on it.', age: 25 * MINUTE },
  { post: 0, author: 'noam_dev', content: 'This is the part everyone gets wrong the first time.', age: 20 * MINUTE },
  { post: 1, author: 'tal_r', content: 'Been burned by the trigger approach before. This is much cleaner.', age: 90 * MINUTE },
  { post: 2, author: 'almog', content: 'Painfully familiar. CI on Ubuntu catches it every time.', age: 4 * HOUR },
  { post: 2, author: 'idan_s', content: 'Add a case-sensitivity check to your pre-commit hook and never think about it again.', age: 3 * HOUR },
  { post: 3, author: 'yael_k', content: 'Beautiful. What camera?', age: 7 * HOUR },
  { post: 3, author: 'tal_r', content: 'Just the phone, honestly.', age: 6 * HOUR },
  { post: 9, author: 'maya_l', content: 'Also commit the lockfile. Half the people who skip npm ci skip that too.', age: 2 * DAY },
  { post: 11, author: 'noam_dev', content: 'Controversial but correct.', age: 4 * DAY },
];

const seed = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed: NODE_ENV is production.');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // CASCADE clears the dependent tables too; RESTART IDENTITY is harmless
    // here since every primary key is a generated UUID.
    console.log('Clearing existing data...');
    await client.query(
      'TRUNCATE users, friendships, posts, comments, messages RESTART IDENTITY CASCADE'
    );

    // One hash reused for every account: bcrypt at cost 12 takes roughly a
    // quarter second, and hashing the same password six times would only make
    // the script slower without making the data more realistic.
    const passwordHash = await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS);

    console.log(`Inserting ${USERS.length} users...`);
    const userIds = {};
    for (const [index, user] of USERS.entries()) {
      const { rows } = await client.query(
        `INSERT INTO users (username, email, password_hash, display_name, bio, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6)
         RETURNING id`,
        [
          user.username,
          user.email,
          passwordHash,
          user.displayName,
          user.bio,
          // Stagger signups so the accounts don't all appear at once.
          ago((USERS.length - index) * 7 * DAY),
        ]
      );
      userIds[user.username] = rows[0].id;
    }

    console.log(`Inserting ${FRIENDSHIPS.length} friendships...`);
    for (const friendship of FRIENDSHIPS) {
      await client.query(
        `INSERT INTO friendships (requester_id, addressee_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $4)`,
        [
          userIds[friendship.requester],
          userIds[friendship.addressee],
          friendship.status,
          ago(3 * DAY),
        ]
      );
    }

    console.log(`Inserting ${POSTS.length} posts...`);
    const postIds = [];
    for (const post of POSTS) {
      const { rows } = await client.query(
        // updated_at is set to the same value as created_at. Left to its
        // DEFAULT NOW() it would land in the present while created_at sits in
        // the past, and the UI marks a post as edited when the two differ.
        `INSERT INTO posts (author_id, content, image_url, visibility, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5)
         RETURNING id`,
        [
          userIds[post.author],
          post.content,
          post.image_url ?? null,
          post.visibility,
          ago(post.age),
        ]
      );
      postIds.push(rows[0].id);
    }

    console.log(`Inserting ${COMMENTS.length} comments...`);
    for (const comment of COMMENTS) {
      await client.query(
        `INSERT INTO comments (post_id, author_id, content, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $4)`,
        [
          postIds[comment.post],
          userIds[comment.author],
          comment.content,
          ago(comment.age),
        ]
      );
    }

    await client.query('COMMIT');

    const visibilityCounts = POSTS.reduce((acc, post) => {
      acc[post.visibility] = (acc[post.visibility] ?? 0) + 1;
      return acc;
    }, {});

    console.log('\nSeed complete.');
    console.log(
      `  ${USERS.length} users, ${FRIENDSHIPS.length} friendships, ` +
        `${POSTS.length} posts, ${COMMENTS.length} comments`
    );
    console.log(
      `  posts by visibility: ${Object.entries(visibilityCounts)
        .map(([key, count]) => `${count} ${key}`)
        .join(', ')}`
    );
    console.log(`\n  Log in as any username below. Password: ${PASSWORD}`);
    console.log(`  ${USERS.map((u) => u.username).join(', ')}`);
    console.log('\n  almog has 2 pending friend requests waiting.\n');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

seed()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error('\nSeed failed:', error.message);
    await pool.end();
    process.exit(1);
  });