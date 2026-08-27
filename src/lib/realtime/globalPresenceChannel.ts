/** Shared Realtime Presence channel every authenticated client joins so the
 * Coach dashboard can see who currently has the app open. Presence state is
 * ephemeral (not persisted), so this is only ever read live, never queried
 * from SQL. */
export const GLOBAL_PRESENCE_CHANNEL = 'presence:global';
