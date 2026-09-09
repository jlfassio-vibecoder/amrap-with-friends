// Relative, not the @/ alias: the edge runtime's tsconfig does not resolve it.
import type { AnalyticsEventName } from './events';

/**
 * Events emitted from the edge middleware rather than from a bundled module.
 *
 * The middleware answers unknown paths with hand-built HTML — there is no
 * Astro layout and no hashed asset it could reference — so its reporting has
 * to be an inline script, and the event name cannot be found by scanning for
 * call sites. Declaring it here, typed, keeps it inside the registry: the
 * annotation fails to compile if the name is not a registered event, and
 * events.test.ts counts a typed declaration as an emission.
 */
export const NOT_FOUND_EVENT: AnalyticsEventName = 'content_404';
