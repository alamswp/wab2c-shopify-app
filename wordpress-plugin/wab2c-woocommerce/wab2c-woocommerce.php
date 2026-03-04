<?php
/**
 * Plugin Name: WAB2C WhatsApp Notifications (WooCommerce)
 * Description: Sends WooCommerce order events to WAB2C webhook for WhatsApp notifications (created, paid, fulfilled, cancelled, refunded, etc).
 * Version: 1.0.0
 * Author: WAB2C
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * Text Domain: wab2c-woocommerce
 */

if (!defined('ABSPATH')) {
  exit;
}

define('WAB2C_WC_VERSION', '1.0.0');
define('WAB2C_WC_PLUGIN_FILE', __FILE__);
define('WAB2C_WC_PLUGIN_DIR', plugin_dir_path(__FILE__));

require_once WAB2C_WC_PLUGIN_DIR . 'includes/class-wab2c-wc-plugin.php';

add_action('plugins_loaded', function () {
  WAB2C_WC_Plugin::instance()->init();
});

