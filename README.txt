Legacy Cut Meridian V49.15-LC9

Separate personal copy of the locked Meridian V49.15 Mobile Layout Recovery build.

Locked / preserved:
- Original Meridian binder layout
- Right-side section tabs
- Schedule, Clients, Supplies, Banking, Studio
- Offline/localStorage saving
- Service worker/PWA setup
- Backup/report systems
- Supply/invoice/banking sync behavior, except payment method now labels invoice-created payments

Targeted Legacy Cut changes only:
- Invoice/order form fields for Legacy Cut LLC
- Product, custom product, Add Item, size, design, font, stain, wood color, personalization checkboxes
- Manual payment method selection: Cash, Square/Card, CashApp, Chime, PayPal, Other
- Receipt format for Legacy Cut LLC
- Receipt share by text/email
- New Project order form now includes an Add Item field after product/custom product for newly offered products

Deployment rule:
Delete existing web branch files and upload ONLY these extracted files into the GitHub repo root. Do not upload the ZIP itself.

Recommended repo:
legacycut-meridian


LC4 patch:
- Cost Per Unit now displays currency-style 2 decimals instead of 4 decimals.
- No layout/navigation changes.


LC6 patch:
- Added Studio → Mockup Builder tab only.
- Scratch Pad and Gallery remain preserved.
- Mockup Builder supports product shapes, wood type, size/thickness, base stain/color, laser-cut text pieces, separate lettering stain/color, font choices, drag placement, duplicate/delete, save mockup, and save to Gallery.
- No Schedule/Clients/Supplies/Banking layout changes.


LC8 patch:
- Mockup Builder selected text editing now updates live without re-rendering the whole Studio page on every keystroke.
- Draft text fields for new lettering no longer rebuild the page while typing.
- Selected lettering text, font, size, finish/color, and rotation update more smoothly.
- Preserves LC4/LC5/LC6 locked systems.


LC9 patch:
- Mockup Builder base wood Width/Height/Thickness inputs now update live without re-rendering while typing.
- Fixes Android keyboard/delete behavior on Height and Thickness fields.
- No layout/navigation changes.
