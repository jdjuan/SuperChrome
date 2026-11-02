# SuperChrome

A personal Chrome extension combining video downloads, Facebook reel details, and popup protection. Uses Juan’s face logo from [jdjuan.io](https://jdjuan.io).

## Features

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

Installation has not been performed as part of repository setup.

## Local download helper

`helper/host.py` contains the native helper source. It requires `/opt/homebrew/bin/python3`, `yt-dlp`, and FFmpeg (`brew install python yt-dlp ffmpeg`).

Juan’s existing Chrome native-host registration still points to the original helper in:

```
/Users/juanherrera/Documents/Codex/2026-10-16/if-i-found-inspiration-for-the/outputs/local-video-downloader/helper
```

Keep that folder until the native-host registration is migrated. Merely cloning this repo does not change Chrome’s registration. On another Mac, register `io.jdjuan.local_video` as a Chrome native messaging host pointing to an executable copy of `helper/host.py`, with allowed origin `chrome-extension://lfbikaodomamodnmfheahbcbkdkaggai/`.

## Development

```
npm ci
npm test
```

Integration tests mock Chrome APIs and check popup interactions, native-message routing, URL validation, popup-protection policy, navigation blocking, and manifest assets. Live Facebook extraction and real downloads require a loaded extension and the installed helper.

## Permissions and privacy

Uses `activeTab`, `scripting`, `storage`, `nativeMessaging`, and `webNavigation`. Popup protection injects scripts across websites and frames at document start, but defaults off outside Cuevana/Cineb. Facebook inspection runs when clicked. Downloads use the local helper to fetch media from the source platform. No analytics or remote backend is included.

Original individual extension folders remain unchanged for rollback. Disable/remove SuperChrome, reload the original downloader, and re-enable the individual extensions to return to the prior setup.
