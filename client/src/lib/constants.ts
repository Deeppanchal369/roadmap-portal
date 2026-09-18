export const CATEGORIES = [
  { value: 'ui-ux', label: 'UI / UX' },
  { value: 'integrations', label: 'Integrations' },
  { value: 'performance', label: 'Performance' },
  { value: 'general', label: 'General' },
] as const;

export const STATUSES = [
  { value: 'under_review', label: 'Under review', tone: 'review' },
  { value: 'planned', label: 'Planned', tone: 'planned' },
  { value: 'in_progress', label: 'In progress', tone: 'progress' },
  { value: 'completed', label: 'Completed', tone: 'done' },
] as const;

export const ROADMAP_COLUMNS = [
  { value: 'planned', label: 'Planned', blurb: 'Accepted and waiting for a slot' },
  { value: 'in_progress', label: 'In progress', blurb: 'Being built right now' },
  { value: 'completed', label: 'Completed', blurb: 'Shipped and live' },
] as const;

export const SORT_OPTIONS = [
  { value: 'trending', label: 'Trending' },
  { value: 'top', label: 'Most upvoted' },
  { value: 'newest', label: 'Newest' },
  { value: 'discussed', label: 'Most discussed' },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]['value'];
export type StatusValue = (typeof STATUSES)[number]['value'];

export const categoryLabel = (value: string) =>
  CATEGORIES.find((c) => c.value === value)?.label ?? value;

export const statusMeta = (value: string) =>
  STATUSES.find((s) => s.value === value) ?? STATUSES[0];

/** Mirrors the server's cap so the UI can hide Reply past the deepest allowed level. */
export const MAX_COMMENT_DEPTH = 4;

/**
 * Mirrors the server's status state machine so the admin dropdown can only
 * ever offer a move the API will actually accept — the server still
 * re-validates on every request, this only keeps the UI honest.
 */
export const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  under_review: ['planned', 'in_progress'],
  planned: ['under_review', 'in_progress'],
  in_progress: ['planned', 'completed'],
  completed: ['in_progress'],
};
