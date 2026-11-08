// Runs only on the iCapOS LinkedIn admin page. It lets the Connect button hand the sender key to
// this extension, so nobody has to copy a key or type a command.
const PAGE_TYPE = "icapos-linkedin-connect";
const REPLY_TYPE = "icapos-linkedin-extension";

function tell(extra) {
  window.postMessage({ type: REPLY_TYPE, installed: true, version: chrome.runtime.getManifest().version, ...extra }, window.location.origin);
}

window.addEventListener("message", async (event) => {
  // Only messages the page itself sent, from the iCapOS origin.
  if (event.source !== window || event.origin !== window.location.origin) return;
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "icapos-linkedin-ping") { tell({}); return; }
  if (data.type !== PAGE_TYPE || typeof data.key !== "string" || !/^lis_[0-9a-f]{48}$/.test(data.key)) return;
  try {
    const res = await chrome.runtime.sendMessage({ kind: "pair", base: window.location.origin, key: data.key });
    tell({ paired: !!res?.ok });
  } catch {
    tell({ paired: false });
  }
});

tell({});
