<?php

if (!defined('ABSPATH')) {
  exit;
}

require_once __DIR__ . '/class-wab2c-wc-settings.php';
require_once __DIR__ . '/class-wab2c-wc-sender.php';

final class WAB2C_WC_Plugin {
  private static $instance = null;

  /** @var WAB2C_WC_Settings */
  public $settings;

  /** @var WAB2C_WC_Sender */
  public $sender;

  public static function instance() {
    if (self::$instance === null) {
      self::$instance = new self();
    }
    return self::$instance;
  }

  public function init() {
    if (!class_exists('WooCommerce')) {
      add_action('admin_notices', function () {
        echo '<div class="notice notice-error"><p><b>WAB2C WooCommerce</b> requires WooCommerce to be installed and active.</p></div>';
      });
      return;
    }

    $this->settings = new WAB2C_WC_Settings();
    $this->sender = new WAB2C_WC_Sender($this->settings);

    // Admin settings
    add_action('admin_menu', array($this->settings, 'register_menu'));
    add_action('admin_init', array($this->settings, 'register_settings'));

    // WooCommerce hooks
    add_action('woocommerce_new_order', array($this, 'on_new_order'), 10, 1);
    add_action('woocommerce_order_status_changed', array($this, 'on_status_changed'), 10, 4);
    add_action('woocommerce_order_refunded', array($this, 'on_refunded'), 10, 2);
  }

  public function on_new_order($order_id) {
    $order = wc_get_order($order_id);
    if (!$order) return;
    $this->sender->handle_event('order_created', $order);
  }

  public function on_status_changed($order_id, $old_status, $new_status, $order) {
    if (!$order) $order = wc_get_order($order_id);
    if (!$order) return;

    // Normalize common events
    if ($new_status === 'processing' || $new_status === 'completed') {
      $this->sender->handle_event('order_paid', $order);
    }
    if ($new_status === 'completed') {
      $this->sender->handle_event('order_fulfilled', $order);
    }
    if ($new_status === 'cancelled') {
      $this->sender->handle_event('order_cancelled', $order);
    }

    // Always also send status_changed (optional template)
    $this->sender->handle_event('order_status_changed', $order, array(
      'old_status' => $old_status,
      'new_status' => $new_status,
    ));
  }

  public function on_refunded($order_id, $refund_id) {
    $order = wc_get_order($order_id);
    if (!$order) return;
    $this->sender->handle_event('order_refunded', $order, array('refund_id' => $refund_id));
  }
}

