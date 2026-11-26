# SuperChrome workflow

- Juan authorizes automatically committing and pushing completed SuperChrome updates to GitHub after the Chrome verification below.
- Reload and verify the unpacked extension in Chrome after updates. Successful Chrome verification is sufficient; do not routinely launch, reload, or test Brave. Check Brave only when Juan explicitly requests it or the issue is Brave-specific. Keep the extension ID stable.
- No new permissions without explaining the need and obtaining any required approval.
- Keep .codegraph/ and local browser settings out of Git.

- Every extension UI must remain readable in light and dark modes. Page overlays must account for the actual site background independently of the OS theme, own their text/background colors, and maintain at least 4.5:1 normal-text contrast. Check both theme mismatches and runtime theme changes. Apply this requirement to future extension features.

- For each releasable change, bump extension/manifest.json and package.json versions together. Pushes to main run verification and publish a new GitHub release if that version is new. Do not overwrite published assets; fix with a new version. Website uses the stable latest-release download URL.

- New user-facing features must have a clearly named option in the popup sidebar, with visible controls and a short explanation.

- Always use the real brand logos for third-party apps and services. Source the actual artwork from the brand or a reputable logo library and bundle it locally. Do not redraw logos or substitute generic or lookalike icons. Use the appropriate official color variant for light and dark UI.
