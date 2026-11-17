const adapter = (window.ADAPTERS || []).find(a => a.matches());
chrome.runtime.onMessage.addListener((msg, _s, send) => {
  if (!adapter) return send({ error: "no adapter" });
  try {
    if (msg.type === "LIST_CHANNELS") send({ channels: adapter.listChannels() });
    else if (msg.type === "GOTO") send({ ok: adapter.currentChannelId() === msg.channelId || adapter.goTo(msg.channelId) });
    else if (msg.type === "SCRAPE") { adapter.scrollToBottom(); send({ channelId: adapter.currentChannelId(), messages: adapter.scrape() }); }
  } catch (e) { send({ error: String(e) }); }
  return true;
});
