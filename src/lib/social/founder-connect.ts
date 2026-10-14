/** Shared bits for the founder account connect flow. The OAuth callbacks are the same
 *  routes iCFO already registered with each network; a short lived cookie set by
 *  /api/founder/social/connect tells the callback the founder started the flow. */
export const FOUNDER_CONNECT_COOKIE = "social_founder_connect";
export const FOUNDER_SOCIAL_PATH = "/founder/deploy/social";
