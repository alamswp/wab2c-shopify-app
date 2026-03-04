<?php

if (!defined('ABSPATH')) {
  exit;
}

class WAB2C_WC_Settings {
  const OPTION_KEY = 'wab2c_wc_settings';

  public function defaults() {
    return array(
      'webhooks' => array(
        'order_created' => '',
        'order_paid' => '',
        'order_fulfilled' => '',
        'order_cancelled' => '',
        'order_refunded' => '',
        'order_status_changed' => ''
      ),
      'auth_header_name' => 'Authorization',
      'auth_header_value' => '',
    );
  }

  public function get() {
    $saved = get_option(self::OPTION_KEY, array());
    $merged = array_replace_recursive($this->defaults(), is_array($saved) ? $saved : array());
    return $merged;
  }

  public function register_menu() {
    add_options_page(
      'WAB2C WhatsApp (WooCommerce)',
      'WAB2C WhatsApp',
      'manage_options',
      'wab2c-woocommerce',
      array($this, 'render_page')
    );
  }

  public function register_settings() {
    register_setting('wab2c_wc_group', self::OPTION_KEY, array(
      'type' => 'array',
      'sanitize_callback' => array($this, 'sanitize'),
      'default' => $this->defaults(),
    ));
  }

  public function sanitize($input) {
    $out = $this->defaults();
    if (!is_array($input)) return $out;

    if (isset($input['webhooks']) && is_array($input['webhooks'])) {
      foreach ($out['webhooks'] as $k => $_) {
        $out['webhooks'][$k] = isset($input['webhooks'][$k]) ? esc_url_raw(trim($input['webhooks'][$k])) : '';
      }
    }
    $out['auth_header_name'] = isset($input['auth_header_name']) ? sanitize_text_field($input['auth_header_name']) : 'Authorization';
    $out['auth_header_value'] = isset($input['auth_header_value']) ? sanitize_text_field($input['auth_header_value']) : '';
    return $out;
  }

  public function render_page() {
    if (!current_user_can('manage_options')) return;
    $opt = $this->get();
    ?>
    <div class="wrap">
      <h1>WAB2C WhatsApp Notifications (WooCommerce)</h1>
      <form method="post" action="options.php">
        <?php settings_fields('wab2c_wc_group'); ?>

        <h2>Connection</h2>
        <p>For each event, paste the webhook URL you created in the WAB2C dashboard (Ecommerce Webhooks). No templates needed here.</p>
        <table class="form-table" role="presentation">
          <?php foreach ($opt['webhooks'] as $event => $url): ?>
            <tr>
              <th scope="row"><label for="wab2c_<?php echo esc_attr($event); ?>"><?php echo esc_html($event); ?> webhook</label></th>
              <td>
                <input class="regular-text" id="wab2c_<?php echo esc_attr($event); ?>" name="<?php echo esc_attr(self::OPTION_KEY); ?>[webhooks][<?php echo esc_attr($event); ?>]" value="<?php echo esc_attr($url); ?>" placeholder="https://app.wab2c.com/api/webhooks/..." />
              </td>
            </tr>
          <?php endforeach; ?>
          <tr>
            <th scope="row"><label for="auth_header_name">Auth Header Name (optional)</label></th>
            <td>
              <input class="regular-text" id="auth_header_name" name="<?php echo esc_attr(self::OPTION_KEY); ?>[auth_header_name]" value="<?php echo esc_attr($opt['auth_header_name']); ?>" placeholder="Authorization" />
            </td>
          </tr>
          <tr>
            <th scope="row"><label for="auth_header_value">Auth Header Value (optional)</label></th>
            <td>
              <input class="regular-text" id="auth_header_value" name="<?php echo esc_attr(self::OPTION_KEY); ?>[auth_header_value]" value="<?php echo esc_attr($opt['auth_header_value']); ?>" placeholder="Bearer ..." />
            </td>
          </tr>
        </table>

        <?php submit_button(); ?>
      </form>
    </div>
    <?php
  }
}

