-- BestiZ Database Schema
-- Database: PostgreSQL 15+


-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ENUM Types

-- Friendship status: a request can be pending or accepted.
-- Rejection / cancellation / removal are all handled by deleting the row.
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted');

-- Post visibility levels as required by the assignment.
CREATE TYPE post_visibility AS ENUM ('public', 'friends', 'private');


-- USERS table
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username        VARCHAR(30)  NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(50)  NOT NULL,
    bio             TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    -- Username constraints: alphanumeric and underscores only, 3-30 chars
    CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]{3,30}$'),
    -- Basic email format check (full validation is done at application layer)
    CONSTRAINT email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- Index for case-insensitive username lookup (used in login flow)
CREATE INDEX idx_users_username_lower ON users (LOWER(username));
CREATE INDEX idx_users_email_lower    ON users (LOWER(email));


-- FRIENDSHIPS table
-- Represents both pending requests and accepted friendships in one table.
-- See README for the rationale behind this design choice.
CREATE TABLE friendships (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          friendship_status NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- A user cannot befriend themselves
    CONSTRAINT no_self_friendship CHECK (requester_id <> addressee_id)
);

-- Critical: prevent duplicate friendships regardless of who initiated.
-- This treats (A, B) and (B, A) as the same pair using LEAST/GREATEST,
-- enforcing the assignment requirement of "no duplicate relationships".
CREATE UNIQUE INDEX idx_friendships_unique_pair
    ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));

-- Indexes for the common queries:
-- 1. "Show me my incoming pending requests"
CREATE INDEX idx_friendships_addressee_status ON friendships (addressee_id, status);
-- 2. "Show me my outgoing pending requests"
CREATE INDEX idx_friendships_requester_status ON friendships (requester_id, status);


-- POSTS table
CREATE TABLE posts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    image_url       TEXT,
    visibility      post_visibility NOT NULL DEFAULT 'public',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Prevent empty posts (note: this allows whitespace; app-layer trims first)
    CONSTRAINT content_not_empty CHECK (LENGTH(content) > 0),
    -- Reasonable upper bound on post length
    CONSTRAINT content_max_length CHECK (LENGTH(content) <= 5000),
    -- Reasonable upper bound on image URL length
    CONSTRAINT image_url_max_length CHECK (image_url IS NULL OR LENGTH(image_url) <= 2000)
);

-- Index for "fetch this user's posts" queries
CREATE INDEX idx_posts_author_created ON posts (author_id, created_at DESC);
-- Index for global feed queries sorted by recency
CREATE INDEX idx_posts_created_at ON posts (created_at DESC);


-- COMMENTS table
CREATE TABLE comments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT comment_content_not_empty CHECK (LENGTH(content) > 0),
    CONSTRAINT comment_max_length CHECK (LENGTH(content) <= 1000)
);

-- Index for "fetch comments for this post" queries
CREATE INDEX idx_comments_post_created ON comments (post_id, created_at ASC);


-- MESSAGES table (Bonus feature)
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    read            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT message_no_self CHECK (sender_id <> recipient_id),
    CONSTRAINT message_content_not_empty CHECK (LENGTH(content) > 0),
    CONSTRAINT message_max_length CHECK (LENGTH(content) <= 2000)
);

-- Composite index for fetching a conversation between two users, sorted by time.
-- The pattern uses LEAST/GREATEST in queries to fetch all messages between
-- two users regardless of direction.
CREATE INDEX idx_messages_conversation
    ON messages (LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id), created_at DESC);

-- Index for "unread messages count" queries
CREATE INDEX idx_messages_recipient_unread
    ON messages (recipient_id) WHERE read = FALSE;


-- Triggers: auto-update `updated_at` on row modification
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_friendships_updated_at
    BEFORE UPDATE ON friendships
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_comments_updated_at
    BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();