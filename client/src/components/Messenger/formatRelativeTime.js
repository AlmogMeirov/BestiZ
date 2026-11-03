/**
 * Short relative timestamps, matching the wording PostCard uses so the two
 * never disagree about how long ago the same moment was.
 */
export const formatRelativeTime = (isoString) => {
  if (!isoString) return '';

  const then = new Date(isoString).getTime();
  const diffSeconds = Math.max(0, Math.floor((Date.now() - then) / 1000));

  if (diffSeconds < 60) return 'just now';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  if (diffSeconds < 7 * 86400) return `${Math.floor(diffSeconds / 86400)}d ago`;
  return new Date(isoString).toLocaleDateString();
};
