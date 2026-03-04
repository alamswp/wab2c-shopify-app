=== WAB2C WhatsApp Notifications (WooCommerce) ===
Contributors: wab2c
Tags: woocommerce, whatsapp, notifications, orders
Requires at least: 5.8
Tested up to: 6.5
Requires PHP: 7.4
Stable tag: 1.0.0

Send WooCommerce order events to WAB2C webhook so you can trigger WhatsApp messages.

== Description ==
This plugin sends order events to your WAB2C webhook:
- order created
- order paid
- order fulfilled (completed)
- order cancelled
- order refunded
- optional: order status changed

This plugin sends the RAW WooCommerce order JSON payload to WAB2C. You do template mapping and variables inside the WAB2C dashboard (Ecommerce Webhooks).

== Installation ==
1. Upload the folder `wab2c-woocommerce` to `/wp-content/plugins/`
2. Activate the plugin in WordPress
3. Go to Settings → WAB2C WhatsApp and paste your WAB2C webhook URL for each event

== Changelog ==
= 1.0.0 =
Initial release

