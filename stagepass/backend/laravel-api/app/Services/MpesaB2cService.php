<?php

namespace App\Services;

use App\Models\B2cPayoutItem;
use App\Models\EventAllowance;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class MpesaB2cService
{
    public function isDryRun(): bool
    {
        return (bool) config('mpesa.dry_run', true);
    }

    public function isConfigured(): bool
    {
        return filled(config('mpesa.consumer_key'))
            && filled(config('mpesa.consumer_secret'))
            && filled(config('mpesa.shortcode'))
            && filled(config('mpesa.initiator_name'))
            && filled(config('mpesa.security_credential'));
    }

    /**
     * Normalize Kenyan MSISDN to 2547XXXXXXXX.
     */
    public function normalizePhone(?string $phone): ?string
    {
        if ($phone === null) {
            return null;
        }
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if ($digits === '') {
            return null;
        }
        if (str_starts_with($digits, '0') && strlen($digits) === 10) {
            $digits = '254'.substr($digits, 1);
        } elseif (str_starts_with($digits, '7') && strlen($digits) === 9) {
            $digits = '254'.$digits;
        } elseif (str_starts_with($digits, '254') && strlen($digits) === 12) {
            // ok
        } else {
            return null;
        }

        return $digits;
    }

    /**
     * Build payout lines from approved EventAllowance rows, grouped by crew.
     *
     * @param  \Illuminate\Support\Collection<int, EventAllowance>  $allowances
     * @return list<array{user_id:int,crew_name:string,phone:?string,phone_ok:bool,amount:float,allowance_ids:list<int>,allowance_count:int,lines:list<array{id:int,type:string,amount:float,event_name:?string}>}>
     */
    public function buildPayoutPreview($allowances): array
    {
        $grouped = $allowances->groupBy('crew_id');
        $out = [];

        foreach ($grouped as $crewId => $rows) {
            /** @var \Illuminate\Support\Collection<int, EventAllowance> $rows */
            $crew = $rows->first()?->crew;
            $phoneRaw = $crew?->phone;
            $phone = $this->normalizePhone($phoneRaw);
            $amount = round((float) $rows->sum(fn (EventAllowance $a) => (float) $a->amount), 2);
            $out[] = [
                'user_id' => (int) $crewId,
                'crew_name' => $crew?->name ?? ('User #'.$crewId),
                'phone' => $phone,
                'phone_display' => $phoneRaw,
                'phone_ok' => $phone !== null && $amount > 0,
                'amount' => $amount,
                'allowance_ids' => $rows->pluck('id')->map(fn ($id) => (int) $id)->values()->all(),
                'allowance_count' => $rows->count(),
                'lines' => $rows->map(function (EventAllowance $a) {
                    return [
                        'id' => (int) $a->id,
                        'type' => $a->type?->name ?? 'Allowance',
                        'amount' => (float) $a->amount,
                        'event_name' => $a->event?->name,
                        'meal_slot' => $a->meal_slot,
                    ];
                })->values()->all(),
            ];
        }

        usort($out, fn ($a, $b) => strcmp($a['crew_name'], $b['crew_name']));

        return $out;
    }

    public function accessToken(): string
    {
        $key = (string) config('mpesa.consumer_key');
        $secret = (string) config('mpesa.consumer_secret');
        $url = rtrim((string) config('mpesa.base_url'), '/').'/oauth/v1/generate?grant_type=client_credentials';

        $response = Http::withBasicAuth($key, $secret)
            ->timeout(30)
            ->get($url);

        if (! $response->successful()) {
            Log::error('M-Pesa OAuth failed', ['status' => $response->status(), 'body' => $response->body()]);
            throw new \RuntimeException('Failed to obtain M-Pesa access token.');
        }

        $token = $response->json('access_token');
        if (! is_string($token) || $token === '') {
            throw new \RuntimeException('M-Pesa access token missing in response.');
        }

        return $token;
    }

    /**
     * @return array{ok:bool,conversation_id:?string,originator_conversation_id:?string,raw:array<string,mixed>,message:string}
     */
    public function sendPayment(string $phone, float $amount, string $remarks, string $occasion = 'Allowance'): array
    {
        if ($this->isDryRun()) {
            $conv = 'DRY'.Str::upper(Str::random(10));

            return [
                'ok' => true,
                'conversation_id' => $conv,
                'originator_conversation_id' => 'ORIG'.$conv,
                'raw' => ['dry_run' => true],
                'message' => 'Dry-run B2C accepted',
            ];
        }

        if (! $this->isConfigured()) {
            return [
                'ok' => false,
                'conversation_id' => null,
                'originator_conversation_id' => null,
                'raw' => [],
                'message' => 'M-Pesa B2C is not configured. Set MPESA_* credentials or enable MPESA_B2C_DRY_RUN.',
            ];
        }

        $token = $this->accessToken();
        $appUrl = rtrim((string) config('app.url'), '/');
        $resultUrl = (string) (config('mpesa.result_url') ?: $appUrl.'/api/mpesa/b2c/result');
        $timeoutUrl = (string) (config('mpesa.timeout_url') ?: $appUrl.'/api/mpesa/b2c/timeout');
        $queueTimeoutUrl = (string) (config('mpesa.queue_timeout_url') ?: $timeoutUrl);

        $payload = [
            'InitiatorName' => (string) config('mpesa.initiator_name'),
            'SecurityCredential' => (string) config('mpesa.security_credential'),
            'CommandID' => 'BusinessPayment',
            'Amount' => (int) round($amount),
            'PartyA' => (string) config('mpesa.shortcode'),
            'PartyB' => $phone,
            'Remarks' => Str::limit($remarks, 100, ''),
            'QueueTimeOutURL' => $queueTimeoutUrl,
            'ResultURL' => $resultUrl,
            'Occasion' => Str::limit($occasion, 100, ''),
        ];

        $url = rtrim((string) config('mpesa.base_url'), '/').'/mpesa/b2c/v1/paymentrequest';
        $response = Http::withToken($token)
            ->timeout(45)
            ->post($url, $payload);

        $raw = $response->json() ?? ['body' => $response->body()];
        $ok = $response->successful()
            && empty($raw['errorCode'] ?? null)
            && ! empty($raw['ConversationID'] ?? null);

        if (! $ok) {
            Log::warning('M-Pesa B2C request failed', ['phone' => $phone, 'amount' => $amount, 'raw' => $raw]);
        }

        return [
            'ok' => $ok,
            'conversation_id' => isset($raw['ConversationID']) ? (string) $raw['ConversationID'] : null,
            'originator_conversation_id' => isset($raw['OriginatorConversationID']) ? (string) $raw['OriginatorConversationID'] : null,
            'raw' => is_array($raw) ? $raw : [],
            'message' => $ok
                ? (string) ($raw['ResponseDescription'] ?? 'B2C accepted')
                : (string) ($raw['errorMessage'] ?? $raw['ResponseDescription'] ?? 'B2C request failed'),
        ];
    }

    public function applyCallbackResult(array $payload): ?B2cPayoutItem
    {
        $result = $payload['Result'] ?? $payload;
        $conversationId = (string) ($result['ConversationID'] ?? '');
        $originatorId = (string) ($result['OriginatorConversationID'] ?? '');
        $resultCode = (string) ($result['ResultCode'] ?? '');
        $resultDesc = (string) ($result['ResultDesc'] ?? '');

        $item = null;
        if ($conversationId !== '') {
            $item = B2cPayoutItem::query()->where('conversation_id', $conversationId)->first();
        }
        if (! $item && $originatorId !== '') {
            $item = B2cPayoutItem::query()->where('originator_conversation_id', $originatorId)->first();
        }
        if (! $item) {
            Log::warning('M-Pesa B2C callback: payout item not found', ['payload' => $payload]);

            return null;
        }

        $transactionId = null;
        $params = $result['ResultParameters']['ResultParameter'] ?? [];
        if (is_array($params)) {
            foreach ($params as $param) {
                if (($param['Key'] ?? '') === 'TransactionReceipt') {
                    $transactionId = (string) ($param['Value'] ?? '');
                }
            }
        }

        $success = $resultCode === '0';
        $item->update([
            'status' => $success ? B2cPayoutItem::STATUS_COMPLETED : B2cPayoutItem::STATUS_FAILED,
            'result_code' => $resultCode,
            'result_desc' => $resultDesc,
            'transaction_id' => $transactionId ?: $item->transaction_id,
            'raw_response' => $payload,
        ]);

        if ($success) {
            $ids = $item->event_allowance_ids ?? [];
            if (is_array($ids) && $ids !== []) {
                EventAllowance::query()
                    ->whereIn('id', $ids)
                    ->where('status', EventAllowance::STATUS_APPROVED)
                    ->update([
                        'status' => EventAllowance::STATUS_PAID,
                        'paid_at' => now(),
                    ]);
            }
        }

        $this->refreshPayoutStatus((int) $item->b2c_payout_id);

        return $item->fresh();
    }

    public function refreshPayoutStatus(int $payoutId): void
    {
        $items = B2cPayoutItem::query()->where('b2c_payout_id', $payoutId)->get();
        if ($items->isEmpty()) {
            return;
        }

        $completed = $items->where('status', B2cPayoutItem::STATUS_COMPLETED)->count();
        $failed = $items->whereIn('status', [B2cPayoutItem::STATUS_FAILED, B2cPayoutItem::STATUS_SKIPPED])->count();
        $total = $items->count();

        $status = \App\Models\B2cPayout::STATUS_PROCESSING;
        if ($completed === $total) {
            $status = \App\Models\B2cPayout::STATUS_COMPLETED;
        } elseif ($failed === $total) {
            $status = \App\Models\B2cPayout::STATUS_FAILED;
        } elseif ($completed > 0 && ($completed + $failed) === $total) {
            $status = \App\Models\B2cPayout::STATUS_PARTIAL;
        }

        \App\Models\B2cPayout::query()->where('id', $payoutId)->update(['status' => $status]);
    }
}
