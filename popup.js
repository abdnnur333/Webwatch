const $ = id => document.getElementById(id);
const get = async (k, d) => (await chrome.storage.local.get(k))[k] ?? d;
const esc = s => String(s ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
async function render() {
  const s = await get("settings", {}), st = await get("status", {}), msgs = await get("messages", {}), cls = await get("cls", {});
  $("status").textContent = `${s.running ? "RUNNING" : "STOPPED"} | ${st.text || ""}`;
  $("provider").value = s.provider || "claude"; $("model").value = s.model || ""; $("interval").value = s.intervalMin || 5;
  const sel = new Set((s.channels || []).map(c => c.id)), all = await get("allChannels", s.channels || []);
  $("chs").innerHTML = all.map(c => `<label><input type="checkbox" data-id="${c.id}" data-name="${esc(c.name)}" ${sel.has(c.id) ? "checked" : ""}> ${esc(c.name)}</label>`).join("<br>");
  $("chs").querySelectorAll("input").forEach(i => i.onchange = saveChannels);
  const list = Object.values(msgs).sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  $("list").innerHTML = list.slice(0, 100).map(m => { const c = cls[m.id] || {};
    return `<div class="m"><span class="${c.category || ""}">${c.category || "…"}</span> #${esc(m.channelName)} <b>${esc(m.author)}</b> <a href="${m.link}" target="_blank">link</a><br>${esc(c.summary || m.content.slice(0, 200))}</div>`; }).join("");
  const dl = Object.entries(cls).filter(([, c]) => c.deadline).sort((a, b) => a[1].deadline.localeCompare(b[1].deadline));
  $("dl").innerHTML = dl.map(([id, c]) => `<div class="m ${c.category}">${esc(c.deadline)} — ${esc(c.task || c.summary)} <a href="${msgs[id]?.link}" target="_blank">src</a>${new Date(c.deadline) < new Date() ? " (expired, not confirmed done)" : ""}</div>`).join("");
}
async function saveChannels() {
  const s = await get("settings", {});
  s.channels = [...$("chs").querySelectorAll("input:checked")].map(i => ({ id: i.dataset.id, name: i.dataset.name }));
  await chrome.storage.local.set({ settings: s });
}
$("load").onclick = async () => {
  const [tab] = await chrome.tabs.query({ url: "https://discord.com/channels/*" });
  if (!tab) return alert("Open Discord Web and the CSE423 server first");
  const r = await chrome.tabs.sendMessage(tab.id, { type: "LIST_CHANNELS" }).catch(() => null);
  if (!r) return alert("Reload the Discord tab (F5) once, then try again");
  await chrome.storage.local.set({ allChannels: r.channels }); render();
};
$("save").onclick = async () => { const s = await get("settings", {});
  Object.assign(s, { provider: $("provider").value, model: $("model").value.trim(), intervalMin: +$("interval").value || 5 });
  if ($("apiKey").value) s.apiKey = $("apiKey").value.trim();
  await chrome.storage.local.set({ settings: s }); $("apiKey").value = ""; };
$("start").onclick = () => chrome.runtime.sendMessage({ type: "START" });
$("stop").onclick = () => chrome.runtime.sendMessage({ type: "STOP" });
$("now").onclick = () => chrome.runtime.sendMessage({ type: "RUN_NOW" });
$("ai").onclick = () => chrome.runtime.sendMessage({ type: "CLASSIFY" });
$("export").onclick = async () => { const d = { messages: await get("messages", {}), cls: await get("cls", {}) };
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 1)], { type: "application/json" })); a.download = "webwatch-export.json"; a.click(); };
chrome.storage.onChanged.addListener(render); render();
