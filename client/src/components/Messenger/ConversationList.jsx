/**
 * The inbox: one row per person, newest activity first.
 *
 * Only conversations the user has agreed to are here. An undecided stranger
 * sits under Requests instead, which is the whole point of the approval step —
 * an inbox anyone can write into is not an inbox.
 */

import Avatar from '../Avatar/Avatar.jsx';
import { useMessenger } from '../../contexts/MessengerContext.jsx';
import { formatRelativeTime } from './formatRelativeTime.js';

import styles from './Messenger.module.css';

const ConversationList = () => {
  const { conversations, openConversation } = useMessenger();

  if (conversations.length === 0) {
    return (
      <p className={styles.empty}>
        No conversations yet. Open someone's profile and say hello.
      </p>
    );
  }

  return (
    <ul className={styles.list}>
      {conversations.map((conversation) => (
        <li key={conversation.id}>
          <button
            type="button"
            className={styles.row}
            onClick={() => openConversation(conversation)}
          >
            <Avatar
              name={conversation.display_name}
              userId={conversation.id}
              size="md"
            />

            <span className={styles.rowBody}>
              <span className={styles.rowTop}>
                <span className={styles.rowName}>
                  {conversation.display_name}
                </span>
                <span className={styles.rowTime}>
                  {formatRelativeTime(conversation.last_message_at)}
                </span>
              </span>

              <span
                className={`${styles.rowPreview} ${
                  conversation.unread_count > 0 ? styles.rowPreviewUnread : ''
                }`}
              >
                {/* "You:" so a thread you spoke in last reads differently
                    from one waiting on your reply. */}
                {conversation.last_message_mine && 'You: '}
                {conversation.last_message_content}
              </span>

              {conversation.request_awaiting_approval && (
                <span className={styles.rowNote}>
                  Waiting for them to accept
                </span>
              )}
            </span>

            {conversation.unread_count > 0 && (
              <span className={styles.rowBadge}>
                {conversation.unread_count}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
};

export default ConversationList;
