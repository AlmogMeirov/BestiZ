/**
 * An open thread: the messages, and whatever the viewer is allowed to do next.
 *
 * What sits below the messages depends entirely on `sendState`, which the
 * server works out. The client never decides for itself whether someone may
 * write — it renders what it was told, and a send that should not have been
 * possible is refused by the API anyway.
 */

import { useEffect, useRef, useState } from 'react';

import { useMessenger } from '../../contexts/MessengerContext.jsx';
import { formatRelativeTime } from './formatRelativeTime.js';

import styles from './Messenger.module.css';

const MAX_LENGTH = 2000;

const ConversationView = () => {
  const {
    thread,
    threadLoading,
    activePartner,
    send,
    accept,
    decline,
  } = useMessenger();

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  // The composer is per-conversation: switching threads must not carry a
  // half-typed message into someone else's window.
  useEffect(() => {
    setDraft('');
    setError('');
  }, [activePartner?.id]);

  // Keep the newest message in view as the thread grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [thread?.messages.length]);

  if (threadLoading && !thread) {
    return <p className={styles.empty}>Loading…</p>;
  }

  if (!thread) {
    return <p className={styles.empty}>Could not load this conversation.</p>;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;

    setSending(true);
    setError('');
    try {
      await send(content);
      setDraft('');
    } catch (err) {
      // The API is the authority on who may write, so its message is shown
      // rather than a guess made here.
      setError(
        err?.response?.data?.error ?? 'Could not send. Please try again.'
      );
    } finally {
      setSending(false);
    }
  };

  // The API returns newest-first; reading order is oldest-first.
  const messages = [...thread.messages].reverse();

  return (
    <div className={styles.thread}>
      <div className={styles.messages}>
        {messages.length === 0 && (
          <p className={styles.empty}>No messages yet. Say something.</p>
        )}

        {messages.map((message) => {
          const mine = message.sender_id !== activePartner.id;
          return (
            <div
              key={message.id}
              className={`${styles.bubbleRow} ${
                mine ? styles.bubbleRowMine : ''
              }`}
            >
              <div
                className={`${styles.bubble} ${mine ? styles.bubbleMine : ''}`}
              >
                <p className={styles.bubbleText}>{message.content}</p>
                <span className={styles.bubbleMeta}>
                  {formatRelativeTime(message.created_at)}
                  {/* Read state is only meaningful for messages we sent —
                      "read" describes the recipient's side. */}
                  {mine && (message.read ? ' · Read' : ' · Sent')}
                </span>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {thread.sendState === 'reply_accepts' && (
        <div className={styles.threadNotice}>
          <p className={styles.threadNoticeText}>
            {activePartner.display_name} wants to message you. Replying accepts
            the request.
          </p>
          <div className={styles.requestActions}>
            <button
              type="button"
              className={styles.acceptButton}
              onClick={() => accept(thread.pendingRequestId)}
            >
              Accept
            </button>
            <button
              type="button"
              className={styles.declineButton}
              onClick={() => decline(thread.pendingRequestId)}
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {thread.sendState === 'awaiting_approval' && (
        <p className={styles.threadClosed}>
          Waiting for {activePartner.display_name} to accept your message
          request.
        </p>
      )}

      {thread.sendState === 'declined' && (
        <p className={styles.threadClosed}>
          You can send more once they accept your request.
        </p>
      )}

      {thread.sendState === 'blocked' && (
        <p className={styles.threadClosed}>
          You cannot send messages to this person.
        </p>
      )}

      {thread.canReply && (
        <form className={styles.composer} onSubmit={handleSubmit}>
          {thread.sendState === 'first_contact' && (
            <p className={styles.composerHint}>
              You are not friends, so this first message goes to them as a
              request.
            </p>
          )}

          {error && <p className={styles.composerError}>{error}</p>}

          <div className={styles.composerRow}>
            <input
              type="text"
              className={styles.composerInput}
              placeholder="Write a message…"
              value={draft}
              maxLength={MAX_LENGTH}
              onChange={(event) => setDraft(event.target.value)}
              disabled={sending}
              aria-label="Message"
            />
            <button
              type="submit"
              className={styles.sendButton}
              disabled={sending || draft.trim().length === 0}
            >
              Send
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ConversationView;
