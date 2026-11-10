/**
 * Store listing URLs for the iCapOS mobile app. Leave a value null until that store
 * listing is live: the homepage app section then shows a "Coming soon" badge in place of
 * the store link. Each live store badge gets its own QR code encoding that store's link.
 * The phone image follows the Google Play link, and falls back to /install (add to home
 * screen) while it is null.
 */
export const APP_STORE_URL: string | null = "https://apps.apple.com/us/app/icapos-startup-funding/id6826579581";
export const PLAY_STORE_URL: string | null = "https://play.google.com/store/apps/details?id=com.icapos.app";
