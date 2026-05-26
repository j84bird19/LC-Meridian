# Legacy Cut Meridian

Personal GitHub-ready PWA for Legacy Cut LLC order intake, receipts, clients, and manual payment tracking.

## Locked scope

- This is a separate personal version.
- Do not overwrite the main Meridian project.
- Manual payment method sync only: Cash, Square/Card, CashApp, Chime, PayPal, Other.
- No account login, no bank APIs, no CashApp/Chime/PayPal/Square transaction connection.

## GitHub Pages upload structure

The repo top level should show:

```text
index.html
manifest.json
service-worker.js
README.md
BUILD_RULES.md
icons/
```

## How to use

1. Create a new GitHub repo, recommended name: `legacycut-meridian`.
2. Upload the contents of this ZIP to the repo root.
3. Enable GitHub Pages from the main branch root.
4. Open the GitHub Pages URL on your phone.
5. Use browser menu > Add to Home Screen.

## Data

Data is stored locally in the browser on the device using localStorage. Use Settings > Export Backup JSON regularly.
