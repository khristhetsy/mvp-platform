import { describe, expect, it } from "vitest";
import { firstValidEmail } from "./recipient";

describe("firstValidEmail", () => {
  it("keeps a clean address", () => {
    expect(firstValidEmail("Jane@Acme.com")).toBe("jane@acme.com");
  });
  it("takes the first of several addresses", () => {
    expect(firstValidEmail("edgar.colomb@gmail.com/ info@southerncutters.net")).toBe("edgar.colomb@gmail.com");
    expect(firstValidEmail("scordovano@bioaegistx.com, s.cordovano@gmail.com")).toBe("scordovano@bioaegistx.com");
    expect(firstValidEmail("sgarrett@silentfalconuas.com     gbishop@silentfalconuas.com")).toBe("sgarrett@silentfalconuas.com");
    expect(firstValidEmail("michal@we-poland.pl ,  michael@vavpay.io")).toBe("michal@we-poland.pl");
  });
  it("strips a trailing period and URL prefix", () => {
    expect(firstValidEmail("di.wu@weissasset.com.")).toBe("di.wu@weissasset.com");
    expect(firstValidEmail("http://hunter@bindpay.xyz")).toBe("hunter@bindpay.xyz");
  });
  it("returns null when nothing is usable", () => {
    expect(firstValidEmail("xandroseaangelinvestors.com")).toBeNull();
    expect(firstValidEmail("https://www.linkedin.com/in/alec13355/")).toBeNull();
    expect(firstValidEmail("")).toBeNull();
    expect(firstValidEmail(null)).toBeNull();
  });
});
