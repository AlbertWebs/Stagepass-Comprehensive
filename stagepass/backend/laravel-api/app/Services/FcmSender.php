<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Sends push notifications via Firebase Cloud Messaging HTTP v1 API.
 * Requires FIREBASE_CREDENTIALS in .env (path to service account JSON).
 */
class FcmSender
{
    private ?string $accessToken = null;

    private ?string $projectId = null;

    public function send(string $token, string $title, string $body, array $data = []): bool
    {
        $credentialsPath = config('services.firebase.credentials');
        if (! $credentialsPath || ! is_readable($credentialsPath)) {
            Log::channel('single')->warning('FCM skipped: FIREBASE_CREDENTIALS not set or file not readable.');
            return false;
        }

        $accessToken = $this->getAccessToken($credentialsPath);
        if (! $accessToken) {
            return false;
        }

        $projectId = $this->projectId ?? $this->parseProjectId($credentialsPath);
        if (! $projectId) {
            Log::channel('single')->warning('FCM skipped: could not determine project_id from credentials.');
            return false;
        }

        $payload = [
            'message' => [
                'token' => $token,
                'notification' => [
                    'title' => $title,
                    'body' => $body,
                ],
                'data' => $this->stringifyData($data),
            ],
        ];

        $url = "https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send";
        $response = Http::withToken($accessToken)
            ->withHeaders(['Content-Type' => 'application/json'])
            ->post($url, $payload);

        if (! $response->successful()) {
            Log::channel('single')->warning('FCM send failed', [
                'status' => $response->status(),
                'body' => $response->json(),
            ]);
            return false;
        }

        return true;
    }

    private function getAccessToken(string $credentialsPath): ?string
    {
        if ($this->accessToken !== null) {
            return $this->accessToken;
        }

        $credentials = json_decode(file_get_contents($credentialsPath), true);
        if (! $credentials) {
            Log::channel('single')->warning('FCM: invalid credentials JSON.');
            return null;
        }

        $this->projectId = $credentials['project_id'] ?? null;
        $clientEmail = $credentials['client_email'] ?? null;
        $privateKey = $credentials['private_key'] ?? null;
        if (! $clientEmail || ! $privateKey) {
            Log::channel('single')->warning('FCM: credentials missing client_email or private_key.');
            return null;
        }

        $jwt = $this->createJwt($credentialsPath, $clientEmail, $privateKey);
        if (! $jwt) {
            return null;
        }

        $response = Http::asForm()->post('https://oauth2.googleapis.com/token', [
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $jwt,
        ]);

        if (! $response->successful()) {
            Log::channel('single')->warning('FCM: failed to get OAuth2 token', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            return null;
        }

        $this->accessToken = $response->json('access_token');
        return $this->accessToken;
    }

    private function createJwt(string $credentialsPath, string $clientEmail, string $privateKey): ?string
    {
        $credentials = json_decode(file_get_contents($credentialsPath), true);
        $now = time();
        $payload = [
            'iss' => $clientEmail,
            'sub' => $clientEmail,
            'aud' => 'https://oauth2.googleapis.com/token',
            'iat' => $now,
            'exp' => $now + 3600,
            'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
        ];
        $header = ['alg' => 'RS256', 'typ' => 'JWT'];
        $segments = [
            $this->base64UrlEncode(json_encode($header)),
            $this->base64UrlEncode(json_encode($payload)),
        ];
        $signingInput = implode('.', $segments);
        $signature = '';
        $key = openssl_pkey_get_private($privateKey);
        if (! $key) {
            Log::channel('single')->warning('FCM: could not load private key.');
            return null;
        }
        openssl_sign($signingInput, $signature, $key, OPENSSL_ALGO_SHA256);
        openssl_free_key($key);
        $segments[] = $this->base64UrlEncode($signature);
        return implode('.', $segments);
    }

    private function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private function parseProjectId(string $credentialsPath): ?string
    {
        $credentials = json_decode(file_get_contents($credentialsPath), true);
        $this->projectId = $credentials['project_id'] ?? null;
        return $this->projectId;
    }

    /** @param array<string, mixed> $data */
    private function stringifyData(array $data): array
    {
        $out = [];
        foreach ($data as $k => $v) {
            $out[(string) $k] = is_scalar($v) ? (string) $v : json_encode($v);
        }
        return $out;
    }
}
