# Security notes

## Critical action required
The previous `checkout.html` exposed a Telegram bot token in public client-side JavaScript. The token has been removed from this project, but **must be revoked/rotated in BotFather** because it should be treated as compromised.

## Static hosting limitations
GitHub Pages cannot securely store API secrets or implement real administrator authentication. The old browser-only admin page was therefore disabled. A production admin panel/order API should run on a backend and keep secrets in environment variables.

## Changes in this build
- Removed Telegram bot token and direct Bot API calls from browser code.
- Removed local persistence of customer orders/PII.
- Checkout totals are recalculated from the catalog rather than trusting a saved total.
- Checkout product prices now match the public catalog.
- Added cart validation and safer localStorage parsing.
- Replaced toast `innerHTML` with `textContent`.
- Added `rel="noopener noreferrer"` to external Telegram link.
- Added null guards to common DOM event bindings.
- Disabled insecure browser-only admin authentication.
