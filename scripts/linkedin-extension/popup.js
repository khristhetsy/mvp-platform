const $ = (id) => document.getElementById(id);
async function render() {
  const s = await chrome.storage.local.get(["base", "key", "live", "status", "statusAt"]);
  const paired = !!(s.base && s.key);
  $("status").textContent = paired ? (s.status || "Connected. Waiting for the next invite.") : "Not connected. Open iCapOS, LinkedIn, Settings and press Connect.";
  $("live").checked = !!s.live;
  $("live").disabled = !paired;
  $("dry").textContent = s.live ? "" : "Dry run: invites are filled in and never sent.";
  $("disconnect").style.display = paired ? "" : "none";
}
$("live").addEventListener("change", async () => { await chrome.storage.local.set({ live: $("live").checked }); render(); });
$("disconnect").addEventListener("click", async () => { await chrome.storage.local.remove(["base", "key", "status", "nextAt"]); render(); });
render();
