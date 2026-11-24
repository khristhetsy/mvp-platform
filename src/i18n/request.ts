import { getRequestConfig } from "next-intl/server";
import { PLATFORM_TZ } from "@/lib/time/platform-tz";

// English only.
export default getRequestConfig(async () => {
  return {
    locale: "en",
    // One display time zone for the platform (PT).
    timeZone: PLATFORM_TZ,
    messages: (await import("../../messages/en.json")).default,
  };
});
