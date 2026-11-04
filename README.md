# SuperChrome

A small browser toolkit for Chrome and Brave. [See it in action and install](https://jdjuan.io/superchrome).

## Tools

- **Feed:** hide Instagram Home posts, stories and suggestions, X Home and LinkedIn Home feeds. Messages and notifications stay available. Reveal feeds for 1, 3 or 5 minutes, then hide them again. Specific LinkedIn post URLs, including highlighted posts under `/feed/`, remain visible; saved element hides are suspended while viewing a specific post.
- **LinkedIn suggestions:** a separate checkbox hides notification cards explicitly marked `REACTIONS_BY_YOUR_NETWORK`, including activity by connections on someone else’s posts. Personal reactions/comments, mentions, and unknown types remain visible. This conservative first filter does not guess from quoted text. A local summary lets you show hidden cards again. It does not delete notifications, mark them read, or alter LinkedIn’s server-side bell count.
- **Hide an element:** pick something on a website and remember it. W selects a larger container, S a smaller one, Esc cancels. Restore saved rules in Feed. Rules may need updating when a site changes.
- **Save:** download supported YouTube, Instagram and X videos using the optional local Python, yt-dlp and FFmpeg helper. Download only media you have permission to save. Downloads go to `~/Downloads/Local Videos`.
- **Instagram images:** a small download arrow on post photos saves the displayed image, including individual carousel slides. No local helper is needed. If Instagram blocks the image request, the button offers a retry.
- **Stats:** inspect available Facebook reel dates/views. Some reels do not expose metadata.
- **Films:** block unwanted popups on Cuevana/Cineb by default, other sites opt-in. Some legitimate external links may need protection turned off.
- **Brave:** automatically reload YouTube once per video per tab when its ad-blocker warning blocks playback. Keeps your ad blocker enabled; playback is not guaranteed. Runs only in Brave.

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

## Gmail dark mode (3.5)

**Appearance → Gmail: follow system theme** darkens the Gmail inbox, opened messages, menus, and compose/reply windows. It follows system appearance by default, automatically enabling dark colors only while the system is dark, works across Gmail accounts in the browser, and saves its preference locally per browser. Gmail tabs open the Appearance tool automatically. Turning it off restores Gmail’s underlying theme immediately.

Each opened message has a **Show original colors** button outside its content. This restores that message’s original design on a light reading surface; **Use dark colors** switches it back. The choice lasts while that message DOM remains open. Photos and logos are not inverted. Dark message rendering normalizes text/background colors and suppresses CSS background images; original colors restore those designs. Embedded cross-origin Google apps (Calendar, Keep, Contacts, Chat, etc.) and attachment previews are outside the scope of this feature.

`gmail-dark.js` batches DOM changes and maps Gmail’s computed surface/text colors to paired dark colors, without depending on its shell’s generated class names. A few stable Gmail selectors identify message bodies, editors, inbox states and monochrome icons. Site theme changes and newly inserted content are reclassified with our stylesheet temporarily gated off during the same task. All CSS is gated by one root attribute. It does not change Gmail account settings or write styles/controls into editable message content. No Gmail API, network service, or additional permissions are used.

Local tests cover toggles and storage failures, startup/account URLs, dynamic messages, runtime theme changes, original-color controls, message/editor HTML integrity, site isolation and at least 4.5:1 text contrast on all four dark surfaces. Chrome live verification covered the inbox, an opened message, original-color switching, monochrome icons, an untouched compose window and immediate restoration through the popup toggle. SuperChrome was reloaded in Chrome and Brave with its stable extension ID. Gmail or email markup changes may require selector adjustments.

### Gmail message-opening flash (3.5.1)

New and reused Gmail panels are classified directly in the mutation observer’s batch, before the next rendering opportunity. Removing the previous 80 ms timer prevents the initial white conversation container from painting when opening an email. Original-color controls and the off toggle retain their behavior. Regression tests assert that inserted conversation shells, headers and reused surfaces are styled by mutation delivery without waiting for a timer.

## LinkedIn dark mode (3.6)

**Appearance → LinkedIn: follow system theme** darkens LinkedIn independently of Gmail and Feed focus. It follows system appearance by default, updates open tabs automatically when the system changes, and persists its opt-out locally per browser. The feature covers feeds, profiles, notifications, jobs, menus, post/comment composers and messaging. Switching it off immediately restores the site's own theme, including an existing native dark theme; it does not change LinkedIn account preferences.

The content script maps computed surface/text colors instead of relying on LinkedIn's generated layout classes. It handles new content during mutation delivery before paint, preserves photos, banners and colored logo artwork, and styles editors through CSS without adding attributes or formatting to their contents. LinkedIn's open `#interop-outlet` shadow root receives a small separately scoped stylesheet and observer for embedded messaging. Same-origin LinkedIn frames are included; third-party ads and external embedded documents are outside this scope. Existing focus and notification overlays refresh their own palettes to match the restored/active page theme.

No permissions were added. Tests cover dynamic panels before paint, SPA routes, same-origin frame URLs, original-theme restoration, independent storage/error rollback, media/editor integrity, messaging shadow content, focus overlay themes under both OS preferences and at least 4.5:1 text contrast. Chrome live verification covered the Feed focus surface, Notifications and immediate restoration of the page and messaging theme gates through the independent popup toggle; generated layout classes and private message content are not stored in the repository.

### System appearance (3.6.2)

Gmail and LinkedIn listen for live system color-scheme changes. Light mode removes the extension’s dark styling and restores the site’s own theme; dark mode reapplies it, including LinkedIn messaging. The Appearance switches enable or disable this automatic behavior. No account theme preferences or extension permissions change.
