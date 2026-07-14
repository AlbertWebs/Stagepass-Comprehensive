<?php

return [
    /*
    |--------------------------------------------------------------------------
    | M-Pesa B2C (Daraja)
    |--------------------------------------------------------------------------
    |
    | Used to disburse earned allowances to crew phones. When dry_run is true,
    | payouts are simulated and allowances are marked paid without calling Safaricom.
    |
    */
    'env' => env('MPESA_ENV', 'sandbox'), // sandbox|production
    'consumer_key' => env('MPESA_CONSUMER_KEY'),
    'consumer_secret' => env('MPESA_CONSUMER_SECRET'),
    'shortcode' => env('MPESA_SHORTCODE'),
    'initiator_name' => env('MPESA_INITIATOR_NAME'),
    'security_credential' => env('MPESA_SECURITY_CREDENTIAL'),
    'dry_run' => filter_var(env('MPESA_B2C_DRY_RUN', true), FILTER_VALIDATE_BOOLEAN),
    'result_url' => env('MPESA_B2C_RESULT_URL'),
    'timeout_url' => env('MPESA_B2C_TIMEOUT_URL'),
    'queue_timeout_url' => env('MPESA_B2C_QUEUE_TIMEOUT_URL'),

    'base_url' => env('MPESA_ENV', 'sandbox') === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke',
];
