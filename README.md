# Bulk Chat Deleter

A Tampermonkey userscript that adds batch deletion to ChatGPT, Gemini, and Claude. The original sites only allow deleting one conversation at a time — requiring three clicks per deletion (open menu → click delete → confirm). This script adds a batch mode with checkboxes so you can select and delete dozens of conversations in one go.

## Supported Platforms

| Platform | URL |
|----------|-----|
| ChatGPT | `chatgpt.com` |
| Gemini | `gemini.google.com` |
| Claude | `claude.ai` |

## Installation

1. Install a userscript manager such as [Tampermonkey](https://www.tampermonkey.net/).
2. Open [Bulk Chat Deleter on GreasyFork](https://greasyfork.org/en/scripts/588305-chatgpt-claude-gemini-bulk-chat-deleter).
3. Click **Install this script** and confirm the installation in your userscript manager.

## Usage

1. Click **Batch Delete** in the sidebar to enter batch mode
   - Checkboxes appear on every conversation item
2. Select conversations manually, or use **Select All** / **Clear**
3. Click **Delete (N)** and confirm
4. A progress bar shows the current deletion count; click **Cancel** to stop mid-run

## How It Works

The script automates the same three-step deletion flow the user would perform manually:
1. Hover over a conversation item to reveal the options button
2. Click the options button → click **Delete** in the dropdown menu
3. Click **Delete** in the confirmation dialog

Deletions run sequentially (menus and dialogs can only be open one at a time). The script tracks items by their conversation URL rather than DOM references, so it remains stable even when the sidebar re-renders between deletions.

## Platform Notes

**ChatGPT**: Items turn gray while the API call is in progress and are removed from the DOM several seconds later. The script does not wait for DOM removal; it proceeds to the next item as soon as the confirmation is clicked.

**Gemini**: Uses Angular Material components. The script waits for the sidebar's conversation list to fully render before injecting the toolbar (Angular lazy-loads it after the outer container appears).

**Claude**: The confirmation dialog's Delete button is briefly disabled after opening (a safety delay). The script waits for the button to become enabled before clicking.
