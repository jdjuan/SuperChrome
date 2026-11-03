# SuperChrome

A small browser toolkit for Chrome and Brave. [See it in action and install](https://jdjuan.io/superchrome).

## Tools

- **Feed:** hide Instagram Home posts, stories and suggestions, X Home and LinkedIn Home feeds. Messages and notifications stay available. Reveal feeds for 1, 3 or 5 minutes, then hide them again. Specific LinkedIn post URLs, including highlighted posts under `/feed/`, remain visible; saved element hides are suspended while viewing a specific post.
- **LinkedIn suggestions:** a separate checkbox hides notification cards explicitly marked `REACTIONS_BY_YOUR_NETWORK`, including activity by connections on someone else’s posts. Personal reactions/comments, mentions, and unknown types remain visible. This conservative first filter does not guess from quoted text. A local summary lets you show hidden cards again. It does not delete notifications, mark them read, or alter LinkedIn’s server-side bell count.
- **Hide an element:** pick something on a website and remember it. W selects a larger container, S a smaller one, Esc cancels. Restore saved rules in Feed. Rules may need updating when a site changes.
- **Save:** download supported YouTube, Instagram and X videos using the optional local Python, yt-dlp and FFmpeg helper. Download only media you have permission to save. Downloads go to `~/Downloads/Local Videos`.
- **Stats:** inspect available Facebook reel dates/views. Some reels do not expose metadata.
- **Films:** block unwanted popups on Cuevana/Cineb by default, other sites opt-in. Some legitimate external links may need protection turned off.
- **Brave:** reload YouTube once per video per tab when its ad-blocker warning interrupts playback. Runs only in Brave.

## Installation

1. [Download the latest release](https://github.com/jdjuan/SuperChrome/releases/latest/download/SuperChrome.zip) and unzip to a permanent folder.
2. Open `chrome://extensions` or `brave://extensions`, enable Developer mode and choose **Load unpacked**. Select `SuperChrome`, the folder containing `manifest.json`.
3. Pin the extension and choose your tools. For video downloads, open **Save → Copy Prompt** and give the setup instructions to an AI with local computer access.

Cloning this repo is also supported: load its `extension` folder. The manifest key preserves extension ID `lfbikaodomamodnmfheahbcbkdkaggai`. A clone alone does not install/register the download helper.

## Updates

When you open the popup, SuperChrome checks the latest public GitHub release, at most once per day. **Check updates** retries immediately. New versions show **Copy update prompt**, with a pinned release URL and checksum file. The prompt guides an AI through replacing files in place and reloading the extension, preserving the extension ID and browser storage. Updates are not silently installed; browser UI steps may require you.

The website uses GitHub's permanent latest-release URL, so it does not need a version edit with every release. Released ZIPs include the extension, portable helper source and installation instructions. SHA256SUMS.txt provides an integrity check, not an independent publisher signature.

## Development and releases

```sh
npm ci
npm test
npm run package
```

Release assets are generated under ignored `work/release/`. Bump `extension/manifest.json` and `package.json` together, then push to `main`. GitHub Actions verifies tests and publishes a release for each new manifest version. Never overwrite a published version: make a new one. Keep the manifest key stable.

The test suite covers feed routing/timers, element hiding, light/dark contrast, popup behavior, native messaging, helper setup, and update checks. Real website layouts and actual downloads still require loaded-browser checks.

## Permissions and privacy

Uses `activeTab`, `scripting`, `storage`, `nativeMessaging` and `webNavigation`. Website content scripts apply hiding rules and popup protection, which defaults off outside Cuevana/Cineb. Facebook inspection runs when clicked. Save passes selected video URLs to the local helper, which contacts the video provider. Settings stay in browser storage.

The update check sends a standard public API request to GitHub with no credentials, page URLs or browser preferences. GitHub receives normal connection metadata such as your IP address. No extra extension permissions, analytics or SuperChrome hosted backend are used. GitHub's API supports CORS for this request.

Uninstall through the extensions page. Remove the optional native-host registration and helper files separately; keep shared Python/yt-dlp/FFmpeg dependencies if other tools need them.
