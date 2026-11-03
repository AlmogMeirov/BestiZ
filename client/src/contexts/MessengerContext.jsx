/**
 * MessengerContext.
 *
 * Owns everything the messenger needs that outlives a single component: is the
 * panel open, which conversation is showing, the inbox and request lists, and
 * the two unread counts behind the navigation badge.
 *
 * This lives in a context rather than inside the panel because the badge in the
 * header has to keep counting while the panel is closed — a message that
 * arrives when nothing is open still needs to show up. Unmounting the panel
 * would unmount its socket listeners along with it.
 *
 * Socket listeners are registered once here, for the whole session, and the
 * lists are refreshed from the server after anything that changes them rather
 * than being patched by hand in every branch. A chat has too many ways to go
 * stale — a second tab, a message that crosses with a read receipt — for
 * hand-maintained local state to stay honest.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import * as messagesApi from '../api/messagesApi.js';
import { connectSocket } from '../socket/socketClient.js';
import { SOCKET_EVENTS } from '../socket/socketEvents.js';
import { useAuth } from './AuthContext.jsx';

const MessengerContext = createContext(null);

export const TABS = { CHATS: 'chats', REQUESTS: 'requests' };

export const MessengerProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState(TABS.CHATS);

  const [conversations, setConversations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [counts, setCounts] = useState({ messages: 0, requests: 0 });

  // The person whose thread is showing, or null for the list view.
  const [activePartner, setActivePartner] = useState(null);
  const [thread, setThread] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  // The API's reason a thread could not be opened, shown instead of a generic
  // failure message.
  const [threadError, setThreadError] = useState('');

  /**
   * The open partner's id, mirrored into a ref.
   *
   * Socket handlers are registered once and would otherwise close over the
   * value of `activePartner` as it was on that render — forever stale. A ref
   * gives them the current value without re-subscribing on every change.
   */
  const activePartnerRef = useRef(null);
  activePartnerRef.current = activePartner?.id ?? null;

  const refreshCounts = useCallback(async () => {
    try {
      setCounts(await messagesApi.getUnreadCount());
    } catch {
      // A failed count is not worth surfacing: the badge is a convenience and
      // the next refresh will correct it.
    }
  }, []);

  const refreshLists = useCallback(async () => {
    try {
      const [nextConversations, nextRequests] = await Promise.all([
        messagesApi.getConversations(),
        messagesApi.getRequests(),
      ]);
      setConversations(nextConversations);
      setRequests(nextRequests);
    } catch {
      // Same reasoning as above; the panel keeps whatever it last had.
    }
  }, []);

  /**
   * Loads a thread and shows it.
   *
   * The GET is what marks the other person's messages as read server-side, so
   * the counts are refreshed straight afterwards rather than adjusted locally:
   * the server has just recalculated them and is the only honest source.
   */
  const openConversation = useCallback(
    async (partner) => {
      setActivePartner(partner);
      setThreadLoading(true);
      setThreadError('');
      try {
        const data = await messagesApi.getConversation(partner.id);
        setThread(data);
        await Promise.all([refreshCounts(), refreshLists()]);
      } catch (error) {
        setThread(null);
        setThreadError(error?.response?.data?.error ?? '');
      } finally {
        setThreadLoading(false);
      }
    },
    [refreshCounts, refreshLists]
  );

  const closeConversation = useCallback(() => {
    setActivePartner(null);
    setThread(null);
    setThreadError('');
  }, []);

  const openMessenger = useCallback(
    (partner) => {
      setIsOpen(true);
      setTab(TABS.CHATS);
      if (partner) {
        openConversation(partner);
      }
    },
    [openConversation]
  );

  const toggleMessenger = useCallback(() => {
    setIsOpen((open) => !open);
  }, []);

  const closeMessenger = useCallback(() => {
    setIsOpen(false);
    closeConversation();
  }, [closeConversation]);

  const send = useCallback(
    async (content) => {
      if (!activePartner) return;

      const message = await messagesApi.sendMessage({
        recipientId: activePartner.id,
        content,
      });

      // Appended rather than re-fetched: the response already contains the
      // stored message, and the composer should clear the instant it lands.
      // Newest-first, matching the order the API returns.
      setThread((current) =>
        current ? { ...current, messages: [message, ...current.messages] } : current
      );

      // The first message to a stranger turns the thread into a pending
      // request, so the send state the UI is holding is now out of date.
      if (thread?.sendState === 'first_contact') {
        const data = await messagesApi.getConversation(activePartner.id);
        setThread(data);
      }

      refreshLists();
      return message;
    },
    [activePartner, thread, refreshLists]
  );

  const accept = useCallback(
    async (requestId) => {
      await messagesApi.acceptRequest(requestId);
      await Promise.all([refreshLists(), refreshCounts()]);
      // Re-read the thread so the composer replaces the Accept / Decline row.
      if (activePartnerRef.current) {
        setThread(await messagesApi.getConversation(activePartnerRef.current));
      }
    },
    [refreshLists, refreshCounts]
  );

  const decline = useCallback(
    async (requestId) => {
      await messagesApi.declineRequest(requestId);
      await Promise.all([refreshLists(), refreshCounts()]);
      closeConversation();
    },
    [refreshLists, refreshCounts, closeConversation]
  );

  // Initial load, and a reset on sign-out so the next person to sign in does
  // not briefly see the previous user's inbox.
  useEffect(() => {
    if (!isAuthenticated) {
      setIsOpen(false);
      setConversations([]);
      setRequests([]);
      setCounts({ messages: 0, requests: 0 });
      closeConversation();
      return;
    }
    refreshCounts();
    refreshLists();
  }, [isAuthenticated, refreshCounts, refreshLists, closeConversation]);

  // Socket wiring. Registered once per session, not per panel open.
  useEffect(() => {
    if (!isAuthenticated) return undefined;

    /**
     * `connectSocket` rather than `getSocket`, because of effect ordering.
     *
     * AuthContext opens the connection in its own effect, but effects run
     * child-first: this provider sits below AuthProvider, so on the render
     * where the session is restored it would ask for a socket that has not
     * been created yet, get null, and silently never subscribe.
     *
     * connectSocket is idempotent — it returns the live socket when one
     * exists — so calling it here removes the ordering question entirely.
     */
    const socket = connectSocket();
    if (!socket) return undefined;

    const onMessage = ({ message }) => {
      const openWith = activePartnerRef.current;

      // Arrived in the thread the user is looking at: re-read it, which both
      // appends the message and marks it read server-side. Patching locally
      // would leave the message unread in the database and the sender without
      // a read receipt.
      if (openWith && message.sender_id === openWith) {
        messagesApi
          .getConversation(openWith)
          .then(setThread)
          .catch(() => {})
          .finally(refreshCounts);
      } else {
        refreshCounts();
      }
      refreshLists();
    };

    const onMessageRead = ({ messageIds }) => {
      // Flip the ticks on our own messages that the other side just read.
      setThread((current) => {
        if (!current) return current;
        const read = new Set(messageIds);
        return {
          ...current,
          messages: current.messages.map((message) =>
            read.has(message.id) ? { ...message, read: true } : message
          ),
        };
      });
    };

    const onRequest = () => {
      refreshCounts();
      refreshLists();
    };

    const onRequestAccepted = () => {
      // Our opening message was accepted, so the composer can open up.
      if (activePartnerRef.current) {
        messagesApi
          .getConversation(activePartnerRef.current)
          .then(setThread)
          .catch(() => {});
      }
      refreshLists();
    };

    socket.on(SOCKET_EVENTS.MESSAGE_RECEIVED, onMessage);
    socket.on(SOCKET_EVENTS.MESSAGE_READ, onMessageRead);
    socket.on(SOCKET_EVENTS.MESSAGE_REQUEST_RECEIVED, onRequest);
    socket.on(SOCKET_EVENTS.MESSAGE_REQUEST_ACCEPTED, onRequestAccepted);

    return () => {
      socket.off(SOCKET_EVENTS.MESSAGE_RECEIVED, onMessage);
      socket.off(SOCKET_EVENTS.MESSAGE_READ, onMessageRead);
      socket.off(SOCKET_EVENTS.MESSAGE_REQUEST_RECEIVED, onRequest);
      socket.off(SOCKET_EVENTS.MESSAGE_REQUEST_ACCEPTED, onRequestAccepted);
    };
  }, [isAuthenticated, refreshCounts, refreshLists]);

  const value = {
    isOpen,
    tab,
    setTab,
    conversations,
    requests,
    counts,
    // One number for the badge: unread messages plus undecided requests. Both
    // are things waiting on the user, and splitting them in the header would
    // need two badges to say one thing.
    badgeCount: counts.messages + counts.requests,
    activePartner,
    thread,
    threadLoading,
    threadError,
    openMessenger,
    toggleMessenger,
    closeMessenger,
    openConversation,
    closeConversation,
    send,
    accept,
    decline,
  };

  return (
    <MessengerContext.Provider value={value}>
      {children}
    </MessengerContext.Provider>
  );
};

export const useMessenger = () => {
  const context = useContext(MessengerContext);
  if (context === null) {
    throw new Error('useMessenger must be used within a MessengerProvider');
  }
  return context;
};
