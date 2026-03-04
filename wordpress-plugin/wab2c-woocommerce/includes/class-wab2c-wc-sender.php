<?php

if (!defined('ABSPATH')) {
  exit;
}

class WAB2C_WC_Sender {
  /** @var WAB2C_WC_Settings */
  private $settings;

  public function __construct($settings) {
    $this->settings = $settings;
  }

  public function handle_event($event, WC_Order $order, $extra = array()) {
    $opt = $this->settings->get();

    $webhook_url = '';
    if (isset($opt['webhooks'][$event])) {
      $webhook_url = trim((string) $opt['webhooks'][$event]);
    }
    if ($webhook_url === '') return;

    // Send RAW WooCommerce order JSON (matches what you see in WAB2C dashboard "Webhook Payload")
    $payload = $order->get_data();

    $headers = array(
      'Content-Type' => 'application/json; charset=utf-8',
      'X-WAB2C-Source' => 'woocommerce',
      'X-WAB2C-Event' => (string) $event,
    );
    $hn = trim((string) $opt['auth_header_name']);
    $hv = trim((string) $opt['auth_header_value']);
    if ($hn !== '' && $hv !== '') {
      $headers[$hn] = $hv;
    }

    wp_remote_post($webhook_url, array(
      'timeout' => 10,
      'headers' => $headers,
      'body' => wp_json_encode($payload),
      'data_format' => 'body',
    ));
  }
}

