SuperChrome — combined local Chrome extension

Includes:
- YouTube, Instagram and X video downloads using the existing native yt-dlp helper.
- Facebook reel dates/views inspection and Watch navigation.
- Popup Guard with global and hostname controls; defaults on Cuevana and Cineb.

Icon: Juan Herrera face logo from https://jdjuan.io/_next/static/media/juan-icon.3a26b6b3.png

INSTALL / REPLACE
1. Keep this folder in place.
2. Open chrome://extensions and use Load unpacked to select the extension/ folder.
3. It uses Local Video Downloader's existing key and ID:
   lfbikaodomamodnmfheahbcbkdkaggai
   Chrome should replace the existing downloader with SuperChrome. If Chrome reports
   a duplicate ID, remove only Local Video Downloader, then load this folder.
4. Disable the separate Facebook Reel Details and Popup Guard extensions so
   the guard is not injected twice. Reload existing website tabs.
5. Pin SuperChrome from Chrome's Extensions menu.
6. Reapply any custom Popup Guard hostname preferences in SuperChrome. Chrome
   isolates storage per extension ID; the old guard's settings remain in its
   disabled extension and are not copied automatically.

The native downloader helper stays in its original location:
/Users/juanherrera/Documents/Codex/2026-10-16/if-i-found-inspiration-for-the/outputs/local-video-downloader/helper
Do not delete that folder or its native host registration.

PERMISSIONS
Uses activeTab, scripting, storage, nativeMessaging, and webNavigation.
Popup Guard's existing all-site content scripts run at document start in all
frames. Protection defaults off outside Cuevana/Cineb until enabled per site.
Facebook inspection runs only when clicked. Downloads are sent to the local
native helper; downloaded media is fetched directly from the video service.
No new analytics or remote backend was added.

VERIFICATION
JavaScript syntax checks and mocked integration tests passed for popup tabs,
Facebook extraction dispatch and Watch URLs, guard site controls/defaults,
background handler coexistence, native messages, supported URL validation,
new-tab blocking and manifest assets. Not yet loaded into Chrome or tested
against live logged-in Facebook pages or an actual video download.

ROLLBACK
Disable/remove SuperChrome, reload the original Local Video Downloader extension
folder, and re-enable the original Facebook Reel Details and Popup Guard.
Original source folders were not changed.
