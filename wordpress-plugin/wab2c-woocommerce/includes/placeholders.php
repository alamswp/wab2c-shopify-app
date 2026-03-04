<?php

if (!defined('ABSPATH')) {
  exit;
}

function wab2c_wc_build_context(WC_Order $order, $extra = array()) {
  $billing_phone = $order->get_billing_phone();
  $shipping_phone = method_exists($order, 'get_shipping_phone') ? $order->get_shipping_phone() : '';

  $ctx = array(
    'order_id' => (string) $order->get_id(),
    'order_number' => (string) $order->get_order_number(),
    'currency' => (string) $order->get_currency(),
    'total' => (string) $order->get_total(),
    'subtotal' => (string) $order->get_subtotal(),
    'status' => (string) $order->get_status(),
    'payment_method' => (string) $order->get_payment_method_title(),

    'customer_first_name' => (string) $order->get_billing_first_name(),
    'customer_last_name' => (string) $order->get_billing_last_name(),
    'customer_name' => trim((string) $order->get_billing_first_name() . ' ' . (string) $order->get_billing_last_name()),
    'customer_email' => (string) $order->get_billing_email(),
    'billing_phone' => (string) $billing_phone,
    'shipping_phone' => (string) $shipping_phone,
  );

  foreach ((array) $extra as $k => $v) {
    $ctx[(string) $k] = (string) $v;
  }

  return $ctx;
}

function wab2c_wc_render_placeholders($template, $ctx) {
  $template = (string) $template;
  if ($template === '') return '';

  return preg_replace_callback('/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/', function ($m) use ($ctx) {
    $key = $m[1];
    return isset($ctx[$key]) ? (string) $ctx[$key] : '';
  }, $template);
}

