// ---------- storage helpers ----------
const get = async (k, d) => (await chrome.storage.local.get(k))[k] ?? d;
const set = (k, v) => chrome.storage.local.set({ [k]: v });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = async (m) => { console.log(m); await set("status", { text: m, at: new Date().toISOString() }); };

// ---------- AI providers (swap here) ----------
const SYSTEM = `You classify Discord messages for a CSE student. For EVERY message return one object.
Categories: URGENT (deadlines, exams, imminent submissions, last-minute changes), IMPORTANT (assignments, quizzes, projects, presentations, grading), NOTICE (class cancellations, schedule changes, announcements), OTHER.
Return ONLY a JSON array: [{"id":"","category":"","summary":"","deadline":"ISO datetime or null","task":"short task title or null","isUpdate":false,"updateNote":""}].
Mark isUpdate true if the message corrects/changes an earlier announcement or deadline. Never assume a task is completed.`;
const PROVIDERS = {
  async claude(cfg, user) {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST",
      headers: { "content-type": "application/json", "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: cfg.model, max_tokens: 4000, system: SYSTEM, messages: [{ role: "user", content: user }] }) });
    const j = await r.json(); if (!r.ok) throw new Error(JSON.stringify(j));
    return j.content.map(c => c.text || "").join("");
  },
  async openai(cfg, user) {
    const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + cfg.apiKey },
      body: JSON.stringify({ model: cfg.model, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }] }) });
    const j = await r.json(); if (!r.ok) throw new Error(JSON.stringify(j));
    return j.choices[0].message.content;
  }
};

async function classifyPending() {
  const cfg = await get("settings", {}); if (!cfg.apiKey) return;
  const msgs = await get("messages", {}), cls = await get("cls", {});
  const todo = Object.values(msgs).filter(m => !cls[m.id] || cls[m.id].hash !== m.hash).slice(0, 25);
  if (!todo.length) return;
  const known = Object.values(cls).filter(c => c.task).map(c => `${c.task} | ${c.deadline}`).slice(-30).join("\n");
  const user = `Known tasks so far (avoid duplicates, detect updates):\n${known}\n\nMessages:\n` +
    todo.map(m => JSON.stringify({ id: m.id, channel: m.channelName, author: m.author, time: m.timestamp, text: m.content, attachments: m.attachments.length, edited: m.edited })).join("\n");
  const raw = await PROVIDERS[cfg.provider || "claude"](cfg, user);
  const arr = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
  for (const r of arr) {
    const m = msgs[r.id]; if (!m) continue;
    cls[r.id] = { ...r, hash: m.hash };
    if (r.category === "URGENT") chrome.notifications.create("n" + r.id, { type: "basic", iconUrl: "icon.png", title: "URGENT: " + (r.task || "CSE423"), message: r.summary || m.content.slice(0, 120) });
  }
  await set("cls", cls);
}

// ---------- collection ----------
const hash = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return String(h); };
async function discordTab() {
  const tabs = await chrome.tabs.query({ url: "https://discord.com/channels/*" });
  return tabs[0];
}
const send = (tabId, msg) => chrome.tabs.sendMessage(tabId, msg);

let busy = false;
async function runCycle() {
  if (busy) return; busy = true;
  try {
    const cfg = await get("settings", {});
    const tab = await discordTab();
    if (!tab) return log("Error: no Discord tab open");
    const channels = cfg.channels || [];
    if (!channels.length) return log("No channels selected");
    const msgs = await get("messages", {});
    let added = 0;
    for (const ch of channels) {
      await log("Reading #" + ch.name);
      let res;
      for (let i = 0; i < 3; i++) {
        try {
          await send(tab.id, { type: "GOTO", channelId: ch.id }); await sleep(2500);
          res = await send(tab.id, { type: "SCRAPE" }); if (res && res.channelId === ch.id) break;
        } catch (e) { await sleep(2000); }
      }
      if (!res || res.channelId !== ch.id) { await log("Failed to read #" + ch.name); continue; }
      for (const m of res.messages) {
        if (m.channelId !== ch.id) continue;
        m.channelName = ch.name; m.hash = hash(m.content + m.attachments.join());
        if (!msgs[m.id]) { msgs[m.id] = m; added++; }
        else if (msgs[m.id].hash !== m.hash) { msgs[m.id] = m; added++; }
      }
      await set("messages", msgs);
    }
    await log(`Cycle done: ${added} new/updated messages`);
    await classifyPending();
  } catch (e) { await log("Error: " + e.message); }
  finally { busy = false; }
}

// ---------- control ----------
chrome.alarms.onAlarm.addListener(a => { if (a.name === "cycle") runCycle(); });
chrome.runtime.onMessage.addListener((msg, _s, send) => {
  (async () => {
    if (msg.type === "START") { const s = await get("settings", {}); await set("settings", { ...s, running: true });
      chrome.alarms.create("cycle", { periodInMinutes: Math.max(1, s.intervalMin || 5) }); runCycle(); }
    if (msg.type === "STOP") { const s = await get("settings", {}); await set("settings", { ...s, running: false }); chrome.alarms.clear("cycle"); await log("Stopped"); }
    if (msg.type === "RUN_NOW") runCycle();
    if (msg.type === "CLASSIFY") { try { await classifyPending(); await log("Classified"); } catch (e) { await log("AI error: " + e.message); } }
    send({ ok: true });
  })();
  return true;
});
// resume after browser restart
chrome.runtime.onStartup.addListener(async () => { const s = await get("settings", {}); if (s.running) chrome.alarms.create("cycle", { periodInMinutes: Math.max(1, s.intervalMin || 5) }); });
