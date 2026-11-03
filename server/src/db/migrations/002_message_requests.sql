-- Message requests
--
-- Direct messages were originally restricted to accepted friends. That is too
-- blunt: someone who read a public post has no way to start a conversation.
-- Opening messaging to everyone is the opposite problem — an open inbox is a
-- spam target.
--
-- This table records the middle ground. A stranger may send exactly ONE
-- message, which creates a pending request. The recipient then decides whether
-- the conversation continues. Approval is independent of friendship: accepting
-- a message request does not make the two people friends, and does not give
-- the sender access to friends-only posts.
--
-- The shape deliberately mirrors the `friendships` table, because the problem
-- is the same one: a directed request between two users that becomes
-- undirected once accepted.

CREATE TYPE message_request_status AS ENUM ('pending', 'accepted', 'declined');

CREATE TABLE message_requests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Whoever sent the opening message.
    requester_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Whoever has to decide.
    recipient_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          message_request_status NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT no_self_message_request CHECK (requester_id <> recipient_id)
);

-- One request per pair, regardless of who opened it.
--
-- This is what enforces the "one message" rule: the opening message and its
-- request row are written in one transaction, so a second attempt from the
-- same sender hits this index and the transaction rolls back. Two messages
-- racing each other in parallel are stopped here too, which application-level
-- checking alone could not guarantee.
--
-- It also prevents the awkward state of A and B each holding a pending request
-- against the other.
CREATE UNIQUE INDEX idx_message_requests_unique_pair
    ON message_requests (LEAST(requester_id, recipient_id), GREATEST(requester_id, recipient_id));

-- "Show me the requests waiting on my decision."
CREATE INDEX idx_message_requests_recipient_status
    ON message_requests (recipient_id, status);

CREATE TRIGGER set_message_requests_updated_at
    BEFORE UPDATE ON message_requests
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
