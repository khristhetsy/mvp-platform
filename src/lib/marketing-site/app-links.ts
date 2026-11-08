/**
 * Store listing URLs for the iCapOS mobile app. Leave a value null until that store
 * listing is live: the homepage app section then shows a "Coming soon" badge in place of
 * the store link. The phone image and QR code follow the Google Play link, and fall back
 * to /install (add to home screen) while it is null.
 */
export const APP_STORE_URL: string | null = null;
export const PLAY_STORE_URL: string | null = "https://play.google.com/store/apps/details?id=com.icapos.app";
