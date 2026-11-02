# SuperChrome

A personal Chrome extension combining video downloads, Facebook reel details, and popup protection. Uses Juan’s face logo from [jdjuan.io](https://jdjuan.io).

## Features

- **Instagram focus:** hides Home feed posts and the top stories tray by default on Instagram. Messages, notifications, profiles and individual posts remain available. Switch it off under **Hide → Hide Instagram home feed & stories**. The preference persists separately in each browser.
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
