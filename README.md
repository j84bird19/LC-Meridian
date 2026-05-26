# Legacy Cut Meridian — Personal PWA

Personal GitHub Pages / PWA version for Legacy Cut LLC.

## Upload structure
Upload these files directly to the top level of a new GitHub repo:

- `index.html`
- `manifest.json`
- `service-worker.js`
- `README.md`
- `BUILD_RULES.md`
- `icons/`

## What this version does

- Mobile-first tabbed navigation
- Legacy Cut order form matching the requested checkbox structure
- Checked options are added to the saved order and receipt
- Manual payment method sync only: Cash, Square/Card, CashApp, Chime, PayPal, Other
- Receipt can be shared through phone share menu, copied, or printed/saved as PDF
- Local saved orders and payment trackers
- Offline caching through service worker
- Backup export/import

## What this version does not do

- It does not connect to real bank/payment accounts.
- It does not modify the main Meridian project.
- It is not an Android Studio project.
