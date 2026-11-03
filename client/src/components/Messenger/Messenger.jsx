/**
 * Messenger.
 *
 * A floating panel rather than a route, so a conversation can be read and
 * replied to without leaving the page underneath — the same reason chat lives
 * in a corner on most social sites. Navigating away to read a message means
 * losing your place in the feed, and losing your place is what stops people
 * replying.
 *
 * The panel is only a shell. It decides between three views — the inbox, the
 * request list, and an open thread — and everything behind them lives in
 * MessengerContext, which keeps counting while the panel is closed.
 *
 * All four files in this folder share one CSS module. They are parts of a
 * single panel rather than components reused elsewhere, and one stylesheet
 * keeps the layout of a thing that has to line up in one place.
 */

import { useMessenger, TABS } from '../../contexts/MessengerContext.jsx';
import ConversationList from './ConversationList.jsx';
import ConversationView from './ConversationView.jsx';
import RequestList from './RequestList.jsx';

import styles from './Messenger.module.css';

const Messenger = () => {
  const {
    isOpen,
    tab,
    setTab,
    counts,
    activePartner,
    closeMessenger,
    closeConversation,
  } = useMessenger();

  if (!isOpen) return null;

  const showingThread = activePartner !== null;

  return (
    <section
      className={styles.panel}
      role="dialog"
      aria-label="Messages"
    >
      <header className={styles.panelHeader}>
        {showingThread ? (
          <>
            <button
              type="button"
              className={styles.iconButton}
              onClick={closeConversation}
              aria-label="Back to conversations"
            >
              ←
            </button>
            <h2 className={styles.panelTitle}>
              {activePartner.display_name || activePartner.username}
            </h2>
          </>
        ) : (
          <h2 className={styles.panelTitle}>Messages</h2>
        )}

        <button
          type="button"
          className={styles.iconButton}
          onClick={closeMessenger}
          aria-label="Close messages"
        >
          ×
        </button>
      </header>

      {/* Tabs belong to the list views; an open thread replaces them. */}
      {!showingThread && (
        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === TABS.CHATS}
            className={`${styles.tab} ${
              tab === TABS.CHATS ? styles.tabActive : ''
            }`}
            onClick={() => setTab(TABS.CHATS)}
          >
            Chats
            {counts.messages > 0 && (
              <span className={styles.tabCount}>{counts.messages}</span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === TABS.REQUESTS}
            className={`${styles.tab} ${
              tab === TABS.REQUESTS ? styles.tabActive : ''
            }`}
            onClick={() => setTab(TABS.REQUESTS)}
          >
            Requests
            {counts.requests > 0 && (
              <span className={styles.tabCount}>{counts.requests}</span>
            )}
          </button>
        </div>
      )}

      <div className={styles.panelBody}>
        {showingThread ? (
          <ConversationView />
        ) : tab === TABS.CHATS ? (
          <ConversationList />
        ) : (
          <RequestList />
        )}
      </div>
    </section>
  );
};

export default Messenger;
