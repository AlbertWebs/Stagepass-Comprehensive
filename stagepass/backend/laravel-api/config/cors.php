<?php

$fromEnv = env('CORS_ALLOWED_ORIGINS');
$allowedOrigins = ['*'];
if (is_string($fromEnv) && trim($fromEnv) !== '') {
    $allowedOrigins = array_values(array_filter(array_map('trim', explode(',', $fromEnv))));
}

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => $allowedOrigins,

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
