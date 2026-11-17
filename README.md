# WebWatch

## Stay ahead of the messages that matter

WebWatch turns busy Discord channels into a clearer view of deadlines, assignments, announcements, and last-minute changes. It checks the channels you choose, uses an AI model to organize new and updated messages, and brings urgent items to your attention—so important details are easier to find when the conversation keeps moving.

WebWatch is a Chrome Manifest V3 extension. Discord Web is its first and currently only supported website adapter.

## What it does

- **Monitors selected Discord channels** in the open Discord Web tab.
- **Classifies messages with AI** as URGENT, IMPORTANT, NOTICE, or OTHER.
- **Surfaces tasks and deadlines** in the extension popup, with links back to their source messages.
- **Flags urgent items** with a Chrome notification.
- **Recognizes possible updates** to previously announced tasks or deadlines.
- **Shows recent collected messages and status** in the popup, and lets you export collected messages and classifications as JSON.

The default classification prompt is tuned for a CSE student: it looks for exams, submissions, assignments, schedule changes, and announcements. It does not mark tasks as complete.

## Get started

1. In Chrome, open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select the WebWatch project folder.
3. Sign in to Discord Web and open the server whose channels you want to monitor.
4. Open the WebWatch popup and choose **Load channels**. If the channel list does not load, reload the Discord tab and try again.
5. Select the channels to monitor.
6. In **Settings**, choose Claude or OpenAI, enter a model name and API key, set the scan interval, and choose **Save**.
7. Choose **Start** to begin monitoring.

Use **Run now** for an immediate scan without changing the recurring schedule. **Classify** retries AI classification for collected messages that are still unclassified or have changed. **Stop** ends scheduled scans.

## How a Discord scan works

WebWatch works through the Discord Web page you already have open; it does not connect to Discord as a bot or use the Discord API.

1. The extension's background service worker finds an open Discord channel tab.
2. For each selected channel, it asks the Discord page's content script to navigate there and read messages currently rendered in the page.
3. It saves new messages and messages whose text or attachments changed in local extension storage.
4. It sends up to 25 pending messages at a time to the configured AI provider for classification.
5. It saves the results, updates the popup, and creates a Chrome notification for URGENT results.

The page needs to be open and signed in to Discord for collection. WebWatch reads messages that Discord has rendered in the page; it is not a full-history archive and may not see older messages that have not been loaded. AI classification requires a valid API key and network access to the selected provider.

## How the timer works

Choose the scan interval in **Settings** (in minutes; default: **5**). When you press **Start**, WebWatch saves the running state, creates a repeating Chrome alarm with a minimum interval of one minute, and starts a scan immediately. Later alarm firings start the next scans. Chrome controls when alarms run, so scans are periodic rather than guaranteed to happen at an exact minute.

The timer belongs to the browser extension, not a remote WebWatch server. If the browser restarts, WebWatch recreates the alarm on startup when monitoring was previously running. Press **Stop** to clear the alarm and turn off the saved running state.

## AI providers and data

WebWatch supports Anthropic's Claude Messages API and OpenAI's Chat Completions API. Choose the provider and enter a model name in Settings. When classification runs, WebWatch sends the selected messages and limited context about previously identified tasks to that provider.

The API key and monitoring data are stored using Chrome's local extension storage. The key is not needed for collecting messages, but classification will be skipped until one is configured. Review your chosen provider's terms and privacy practices before sending it Discord content.

## Current scope

WebWatch is an early prototype. Discord Web is the only implemented adapter; support for other websites would require adding and wiring an adapter. Message collection depends on Discord's current page structure and the messages loaded into that page. Treat AI classifications and extracted deadlines as helpful triage, not a substitute for checking the original message.
