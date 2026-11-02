# SuperChrome

A personal Chrome extension combining video downloads, Facebook reel details, and popup protection. Uses Juan’s face logo from [jdjuan.io](https://jdjuan.io).

## Features

- **Instagram focus:** hides Home feed posts, the top stories tray and the suggestions sidebar by default on Instagram. Messages, notifications, profiles and individual posts remain available. Switch it off under **Hide → Hide Instagram feed, stories & suggestions**. The preference persists separately in each browser.
- **Hide:** choose **Hide → Pick element to hide**, point at an element, and click. Use ↑ to select its parent container, ↓ to select a child, and Esc to cancel. Choices persist per hostname across future visits and apply to dynamically inserted matching elements. Restore individual items or all items from the Hide tab. Rules stay local to each browser and may need to be picked again if a website changes its layout. Cross-origin popups can be hidden by selecting their enclosing iframe/container; content inside closed shadow roots is not individually selectable.
- **Download:** save YouTube, Instagram and X videos to `~/Downloads/Local Videos` through a local yt-dlp/FFmpeg helper. Downloads continue after the popup closes.
- **Reel details:** inspect available Facebook video dates and views, or open a reel in Watch. Facebook can omit metadata or redirect back to Reels.
- **Popup guard:** block new windows and external links on protected sites. Enabled by default on Cuevana/Cineb, with controls for any other hostname.

The popup selects Reel details on Facebook and Popup guard on Cuevana/Cineb.

## Load in Chrome

1. Keep this repository at `/Users/juanherrera/CODE/SuperChrome`.
2. Open `chrome://extensions`, enable Developer mode, and choose **Load unpacked** → this repository’s `extension` folder.
3. The extension preserves Local Video Downloader’s key and ID (`lfbikaodomamodnmfheahbcbkdkaggai`) so its existing native helper remains compatible. If Chrome reports a duplicate ID, remove the old Local Video Downloader and load this folder again.
4. Disable the separate Facebook Reel Details and Popup Guard extensions, then reload existing website tabs.
5. Pin **SuperChrome**. Reapply custom Popup Guard hostname settings; the old guard’s settings belong to its separate extension ID.

SuperChrome is installed and pinned in Chrome and Brave on Juan’s Mac. After an update, reload it in each browser’s extensions page and refresh website tabs.

## Local download helper

`helper/host.py` contains the native helper source. It requires `/opt/homebrew/bin/python3`, `yt-dlp`, and FFmpeg (`brew install python yt-dlp ffmpeg`).

Chrome and Brave native-host registrations point to this repository’s helper:

```
/Users/juanherrera/CODE/SuperChrome/helper/host.py
```

Keep this repository in place. Merely cloning this repo on another Mac does not create browser registrations. On another Mac, register `io.jdjuan.local_video` as a Chrome native messaging host pointing to an executable copy of `helper/host.py`, with allowed origin `chrome-extension://lfbikaodomamodnmfheahbcbkdkaggai/`.

## Development

```
npm ci
npm test
```

Integration tests cover remembered element selection (including iframe parents and clicks without prior movement), dynamic content, site isolation, restoring items, and concurrent saves. Additional tests mock Chrome APIs and check popup interactions, native-message routing, URL validation, popup-protection policy, navigation blocking, and manifest assets. Live Facebook extraction and real downloads require a loaded extension and the installed helper.

## Permissions and privacy

Uses `activeTab`, `scripting`, `storage`, `nativeMessaging`, and `webNavigation`. Popup protection injects scripts across websites and frames at document start, but defaults off outside Cuevana/Cineb. Facebook inspection runs when clicked. Downloads use the local helper to fetch media from the source platform. No analytics or remote backend is included.

Original individual extension folders remain unchanged for rollback. Disable/remove SuperChrome, reload the original downloader, and re-enable the individual extensions to return to the prior setup.

## Updates

Juan authorizes automatic commits and pushes of verified updates to this extension. See `AGENTS.md`. Existing permissions cover the Hide feature; no permission expansion was added.

Hide was checked in Chrome on LinkedIn: the Agree & Join overlay, Google account prompt, and top Sign in button were selected through the picker. Saved overlay rules persisted after refreshing the page. Chrome and Brave were reloaded to version 2.1.0. User-specific hiding rules are browser storage, not repository content.

Instagram focus is scoped to the Home route and targets feed articles and Instagram’s `story_tray` marker, excluding dialogs. SPA navigation, newly loaded posts, saved preferences, messages/notification routes and profile/post routes are covered by tests. No additional permissions are required.

Instagram safety: saved click-to-hide rules (including older broad selectors) apply only on Home. They are automatically suspended on inbox, conversation, activity, profile and post routes; the picker is offered only on Home for Instagram. This prevents shared Instagram layout classes from blanking the inbox. Other websites retain hostname-wide rules.

With focus enabled, Home displays “You have better things to do.” and “But if not, set a limit:” with 1 min, 3 min and 5 min buttons. The observed feed-and-suggestions shell is hidden as a unit (including loading spinners and sidebar footer links); navigation and dialogs remain outside that boundary. Disabling focus or leaving Home removes the message and restores the original layout.

Choosing a limit temporarily reveals the Home feed, stories and suggestions, including elements hidden by saved Instagram rules. A small countdown includes a Hide now control. The wall-clock deadline is stored locally per browser and shared across Instagram tabs; refreshes do not reset it. At expiry, Home is hidden again with “Time’s up. Instagram will survive.” Messages and notifications are unaffected. Background-tab throttling is handled by checking the deadline on return to the page. Changing the focus checkbox clears any active allowance.

## X focus

On X (and legacy twitter.com URLs), **Hide → Hide X home feed** independently controls the Home timeline. It uses the same message and 1/3/5-minute allowances as Instagram, with separate `xFocus` and `xRevealUntil` storage. Expiry reads “Time’s up. X will survive.” Timers survive refreshes and share the deadline across tabs in the same browser. The post composer, sidebar, messages drawer and navigation remain available. The feature does not hide notifications, messages, search, profiles or individual posts. Saved generic hide rules on X are Home-only and pause during an allowance. No new permissions were added.

X selectors are covered by local DOM integration tests; this release has not been verified in a live X account.

X structural selector reference: [Minimal Theme’s maintained selector definitions](https://github.com/typefully/minimal-twitter/blob/main/content-scripts/src/selectors.js). Feed posts are matched by `data-testid` rather than requiring a specific HTML tag.

## YouTube warning recovery

On YouTube, **Hide → Retry YouTube ad-blocker warning once** enables a single automatic reload when a visible player warning matches the supplied ad-blocker warning. It is enabled by default in both Brave and Chrome. If Chrome keeps showing the warning, SuperChrome leaves it alone after that one retry. It does not change Shields, ad-blocker settings, ads, or YouTube authentication.

A background worker records the video ID in `chrome.storage.session` before calling `tabs.reload`. The limit is per video, per tab, during the extension session, and survives page reloads and worker restarts. Returning to an already retried video does not reset it; opening a different video permits one retry for that video. Closing the tab clears its record. Restarting the browser or reloading the extension clears session storage. If the retry record cannot be saved, no reload occurs. The handler rechecks the current video before reloading and ignores stale or subframe requests.

Detection is limited to watch/live video pages and visible YouTube player error/enforcement elements with matching warning text (English, plus common Spanish headline forms). Hidden templates, ordinary video errors and comments are ignored. YouTube may change its markup or wording. Automated tests cover once-only behavior, concurrent requests, new documents/workers, SPA navigation, false positives and storage failure; live reproduction in Brave is not verified.

The feature uses existing permissions. [Chrome storage documentation](https://developer.chrome.com/docs/extensions/reference/api/storage) and [Tabs API documentation](https://developer.chrome.com/docs/extensions/reference/api/tabs) describe the session state and reload APIs used here.

## LinkedIn focus

**Hide → Hide LinkedIn home feed** independently controls the timeline on `/feed` and `/feed/`. It presents the same “You have better things to do.” message and 1/3/5-minute choices, with a persisted deadline, countdown and Hide now control. Expiry reads “Time’s up. LinkedIn will survive.” The settings use independent `linkedinFocus` and `linkedinRevealUntil` keys. The post composer, messaging overlays, notification/job/profile routes and individual post pages (including `/feed/update/…`) are excluded. Existing saved hide rules are temporarily paused during a LinkedIn allowance and otherwise remain intact, including older sign-in prompt rules.

Local DOM tests cover feed selectors, dynamically inserted posts, dialog/chat/composer exclusions, timed breaks, refresh persistence and route changes. Live verification in a logged-in LinkedIn feed is pending. The feature uses existing permissions.

LinkedIn 2.7.1 compatibility: the live account uses a `data-testid="mainFeed"` list and `componentkey="update-card-focus…"` cards, with none of the older feed classes. The list also contains the composer and sort controls, so only its post cards are hidden; the focus message is inserted before the first post’s lazy-mount wrapper. Read-only live inspection matched eight post cards and no composer or messaging overlay. Regression tests cover this layout and legacy markup. Rendering after extension reload is still pending.

## Light and dark mode

`extension/theme.js` provides a shared palette for focus messages, countdowns, the element picker and Facebook details panel. It reads the actual ancestor backgrounds (including transparent layers) rather than assuming the website follows the OS theme. These components own paired text and background colors, preventing light-on-light text even if theme detection falls back. Instagram/X/LinkedIn focus components re-evaluate the site theme while active. The extension popup owns its light/dark palette and form-control colors via system color preference. New UI must follow the readability requirement in `AGENTS.md`.

Theme regression tests cover all four site/OS light-dark combinations, nested/translucent backgrounds, runtime site changes, and at least 4.5:1 normal-text contrast for message, secondary copy and button colors. Existing integration tests remain passing. Browser appearance after loading version 2.8.0 is not yet visually verified.

LinkedIn 2.8.1 also hides `role="progressbar"` indicators inside `mainFeed` while focus is active. These selectors come from the live feed’s SVG loaders. Dialog and messaging loaders are excluded; feed loaders return during timed breaks or when focus is disabled. Regression tests cover all three states and dynamically inserted loaders.

## Popup design (3.0)

The popup is a 440px personal toolbox with a vertical, keyboard-accessible tool rail and one scrolling workspace. Page tools opens first on ordinary websites, Save on YouTube, Reels on Facebook, and Guard on its default protected sites. Contextual website settings lead the Page view. The rail and workspace scroll independently to accommodate future features without adding crowded horizontal tabs. New tools need a tab with `aria-controls` and a corresponding panel; navigation discovers tabs from the DOM and does not rely on positional indices.

The visual system uses a blue/slate palette, compact native sans-serif typography, explicit light/dark surfaces, accessible focus states and toggle controls. The page overlays use the coordinated shared palette. Frontend Design from anthropics/skills guided the redesign. Both popup themes were reviewed in a local browser preview using mock extension APIs; all existing integration tests and new keyboard/context-navigation checks pass. Extension reload in Chrome/Brave is still needed to activate this version.

3.0.1 simplifies Page controls: all four feature checkboxes are always visible, including on pages without an accessible URL. Marketing copy and repeated explanations were removed. Native checkbox controls replace the switches. Element picking still requires an ordinary website; missing tab URLs show a short instruction rather than a raw URL exception.

3.0.2 uses the tool names Hide, Save, Stats and Ads, with concise action labels throughout. Ads is popup blocking: Cuevana/Cineb are on by default, other sites are opt-in. Its master checkbox pauses/resumes blocking on enabled sites; it does not enable blocking on every website.
