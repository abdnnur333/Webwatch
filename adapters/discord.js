// Website adapter: Discord Web. Add more adapters (window.ADAPTERS.push) for other sites.
window.ADAPTERS = window.ADAPTERS || [];
window.ADAPTERS.push({
  name: "discord",
  matches: () => location.hostname === "discord.com",
  listChannels() {
    const out = [], seen = new Set();
    document.querySelectorAll('a[data-list-item-id^="channels___"]').forEach(a => {
      const m = (a.getAttribute("href") || "").match(/channels\/(\d+)\/(\d+)/);
      if (!m || seen.has(m[2])) return;
      seen.add(m[2]);
      out.push({ id: m[2], guildId: m[1], name: (a.getAttribute("aria-label") || a.innerText || m[2]).split(/[\n(]/)[0].trim() });
    });
    return out;
  },
  currentChannelId() {
    const m = location.pathname.match(/channels\/(\d+)\/(\d+)/);
    return m ? m[2] : null;
  },
  goTo(channelId) {
    const a = document.querySelector(`a[data-list-item-id="channels___${channelId}"]`);
    if (!a) return false;
    a.click();
    return true;
  },
  scrollToBottom() {
    const ol = document.querySelector('ol[data-list-id="chat-messages"]');
    let el = ol && ol.parentElement;
    while (el && el.scrollHeight <= el.clientHeight) el = el.parentElement;
    if (el) el.scrollTop = el.scrollHeight;
  },
  scrape() {
    const g = (location.pathname.match(/channels\/(\d+)/) || [])[1];
    const out = []; let lastAuthor = "", lastTime = "";
    document.querySelectorAll('li[id^="chat-messages-"]').forEach(li => {
      const p = li.id.split("-"); // chat-messages-<channelId>-<messageId>
      const channelId = p[2], id = p[3];
      const a = li.querySelector('[class*="username_"]');
      if (a) lastAuthor = a.innerText.trim();
      const t = li.querySelector("time");
      if (t && t.getAttribute("datetime")) lastTime = t.getAttribute("datetime");
      const c = li.querySelector('[id^="message-content-"]');
      const content = c ? c.innerText.trim() : "";
      const attachments = [...li.querySelectorAll('a[href*="cdn.discordapp.com/attachments"], a[href*="media.discordapp.net/attachments"]')].map(x => x.href);
      if (!content && !attachments.length) return;
      out.push({ id, channelId, guildId: g, author: lastAuthor, timestamp: lastTime, content, attachments,
        edited: !!li.querySelector('[class*="edited_"]'),
        link: `https://discord.com/channels/${g}/${channelId}/${id}` });
    });
    return out;
  }
});
