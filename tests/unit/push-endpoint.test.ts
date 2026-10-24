import { describe, expect, it } from "vitest";
import { isPushEndpoint } from "@/lib/push-endpoint";

describe("isPushEndpoint", () => {
  it("accepts the browsers' push services", () => {
    expect(isPushEndpoint("https://fcm.googleapis.com/fcm/send/abc:123")).toBe(true);
    expect(isPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(isPushEndpoint("https://web.push.apple.com/QGx")).toBe(true);
    expect(isPushEndpoint("https://wns2-db5p.notify.windows.com/w/?token=x")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isPushEndpoint("http://fcm.googleapis.com/fcm/send/abc")).toBe(false);
    expect(isPushEndpoint("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isPushEndpoint("https://fcm.googleapis.com.evil.com/x")).toBe(false);
    expect(isPushEndpoint("https://evil.com/notify.windows.com")).toBe(false);
    expect(isPushEndpoint("https://fcm.googleapis.com:8443/x")).toBe(false);
    expect(isPushEndpoint("https://user@fcm.googleapis.com/x")).toBe(false);
    expect(isPushEndpoint("not a url")).toBe(false);
  });
});
