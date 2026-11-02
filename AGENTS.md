# SuperChrome workflow

- Juan authorizes automatically committing and pushing completed SuperChrome updates to GitHub after appropriate local verification. Do not ask again for routine commits/pushes for this extension.
- Reload the unpacked extension in Chrome and Brave after updates when available. Keep the extension ID stable.
- No new permissions without explaining the need and obtaining any required approval.
- Keep .codegraph/ and local browser settings out of Git.

- Every extension UI must remain readable in light and dark modes. Page overlays must account for the actual site background independently of the OS theme, own their text/background colors, and maintain at least 4.5:1 normal-text contrast. Check both theme mismatches and runtime theme changes. Apply this requirement to future extension features.
