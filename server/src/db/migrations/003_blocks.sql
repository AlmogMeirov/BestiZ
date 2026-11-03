-- Blocks
--
-- Unfriending stops someone seeing friends-only posts, and declining a message
-- request stops them writing. Neither stops someone from reading every public
-- post, commenting on them, and sending a fresh friend request. Blocking is
-- the tool for that.
--
-- A block cuts the pair off from each other in both directions: no messages,
-- no friend requests, no seeing each other's posts, no commenting. The
-- existing message history is deliberately NOT deleted — a conversation
-- belongs to both people, and one of them should not be able to erase the
-- other's copy.
--
-- Note the shape is DIRECTIONAL, and unlike `friendships` and
-- `message_requests` there is no LEAST/GREATEST unique index. "A blocked B"
-- and "B blocked A" are two independent facts and both rows may exist at once:
-- if A blocks B and later unblocks, B's own block must survive. The effects of
-- a block are symmetric, but the record of who performed it is not, and
-- collapsing the pair would lose exactly the information unblocking needs.

CREATE TABLE blocks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- The user who performed the block.
    blocker_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- The user on the receiving end.
    blocked_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT no_self_block CHECK (blocker_id <> blocked_id),
    -- One row per ordered pair: blocking twice is the same fact, not two.
    CONSTRAINT blocks_unique_direction UNIQUE (blocker_id, blocked_id)
);

-- "Who have I blocked?" — the manage-blocks screen. The UNIQUE constraint
-- above already indexes (blocker_id, blocked_id), so this direction is covered.

-- "Has this person blocked me?" Every permission check asks about a pair in
-- BOTH directions, so the reverse lookup needs its own index; without it that
-- half of the check is a sequential scan.
CREATE INDEX idx_blocks_blocked_blocker
    ON blocks (blocked_id, blocker_id);
