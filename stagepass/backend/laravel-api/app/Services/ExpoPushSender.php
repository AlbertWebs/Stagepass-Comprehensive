<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Sends push notifications via Expo Push API (https://docs.expo.dev/push-notifications/sending-notifications/).
 * Works with tokens from expo-notifications getExpoPushTokenAsync (ExponentPushToken[...]).
 */
class ExpoPushSender
{
    private const PUSH_URL = 'https://exp.host/--/api/v2/push/send';

    public static function isExpoPushToken(string $token): bool
    {
        $t = trim($token);

        return str_starts_with($t, 'ExponentPushToken[')
            || str_starts_with($t, 'ExpoPushToken[');
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function send(string $token, string $title, string $body, array $data = []): bool
    {
        if (! self::isExpoPushToken($token)) {
            return false;
        }

        $payload = [
            'to' => $token,
            'title' => $title,
            'body' => $body,
            'sound' => 'default',
            'priority' => 'high',
            'data' => $this->stringifyData($data),
        ];

        $response = Http::withHeaders([
            'Accept' => 'application/json',
            'Content-Type' => 'application/json',
        ])->timeout(15)->post(self::PUSH_URL, $payload);

        if (! $response->successful()) {
            Log::channel('single')->warning('Expo push send failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return false;
        }

        $json = $response->json();
        $dataBlock = $json['data'] ?? null;
        if (is_array($dataBlock)) {
            if (isset($dataBlock['status'])) {
                if (($dataBlock['status'] ?? '') === 'error') {
                    Log::channel('single')->warning('Expo push ticket error', ['data' => $dataBlock]);

                    return false;
                }

                return true;
            }
            foreach ($dataBlock as $item) {
                if (is_array($item) && ($item['status'] ?? '') === 'error') {
                    Log::channel('single')->warning('Expo push ticket error', ['item' => $item]);

                    return false;
                }
            }
        }

        return true;
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
