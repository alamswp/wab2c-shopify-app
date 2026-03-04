## WAB2C Shopify Webhook App (Order → WhatsApp)

This is a small Shopify app (Node + Express) that:

- Installs on a Shopify store (OAuth)
- Registers Shopify webhooks for order events
- Verifies webhook HMAC (security)
- Forwards the webhook payload to your **WAB2C webhook/API** so your WhatsApp automation can run (order created, cancelled, paid, fulfilled, etc.)

### Setup

1. Install dependencies

```bash
cd /home/fawadmughal/Desktop/Shopify-plugin-WAB2C
npm install
```

2. Create your env file

Copy `env.example` to `env` and fill values.

```bash
cp env.example env
```

3. Run in dev

```bash
npm run dev
```

### Shopify app setup (how merchant installs)

You must create a Shopify app (custom app or Partner app) to get:

- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`

Then host this app on a **public HTTPS URL** (or use a tunnel like ngrok during testing) and set:

- `APP_URL=https://your-public-domain.com`

In Shopify app settings, set:

- **App URL**: `APP_URL`
- **Allowed redirection URL(s)**: `APP_URL/auth/callback`

Then install by opening:

- `GET APP_URL/auth?shop=your-store.myshopify.com`

After install, the app auto-registers webhooks and redirects you to the Settings page where you can enter your WAB2C webhook URL + auth header.

### URLs

- **Install URL**: `GET /auth?shop=your-store.myshopify.com`
- **OAuth callback**: `GET /auth/callback`
- **Webhook receiver**: `POST /webhooks` (Shopify sends topic in headers)

### Notes

- For production you must host the app on a public HTTPS URL and set `APP_URL` to that.
- Webhooks are registered to `APP_URL + /webhooks`.


