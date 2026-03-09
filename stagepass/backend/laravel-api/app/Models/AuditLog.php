<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    protected $fillable = [
        'user_id',
        'method',
        'path',
        'full_url',
        'source',
        'ip_address',
        'user_agent',
        'response_status',
    ];

    public const SOURCE_WEB = 'web';
    public const SOURCE_MOBILE = 'mobile';
    public const SOURCE_API = 'api';

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function inferSource(?string $userAgent, ?string $clientHeader): string
    {
        if ($clientHeader) {
            $h = strtolower(trim($clientHeader));
            if (str_contains($h, 'mobile')) {
                return self::SOURCE_MOBILE;
            }
            if (str_contains($h, 'web')) {
                return self::SOURCE_WEB;
            }
        }
        if ($userAgent) {
            $ua = strtolower($userAgent);
            // Mobile app often sends a custom UA
            if (str_contains($ua, 'stagepass') && (str_contains($ua, 'android') || str_contains($ua, 'ios'))) {
                return self::SOURCE_MOBILE;
            }
            if (str_contains($ua, 'android') || str_contains($ua, 'iphone') || str_contains($ua, 'mobile')) {
                return self::SOURCE_MOBILE;
            }
        }
        return self::SOURCE_WEB;
    }
}
