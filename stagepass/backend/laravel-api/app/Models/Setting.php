<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class Setting extends Model
{
    protected $table = 'settings';

    protected $primaryKey = 'key';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['key', 'value'];

    public static function get(string $key, mixed $default = null): mixed
    {
        $all = self::getAllCached();
        return $all[$key] ?? $default;
    }

    public static function set(string $key, mixed $value): void
    {
        self::updateOrCreate(['key' => $key], ['value' => self::serialize($value)]);
        self::clearCache();
    }

    public static function getMany(array $keys): array
    {
        $all = self::getAllCached();
        $out = [];
        foreach ($keys as $k) {
            $out[$k] = $all[$k] ?? null;
        }
        return $out;
    }

    public static function setMany(array $values): void
    {
        foreach ($values as $key => $value) {
            self::updateOrCreate(['key' => $key], ['value' => self::serialize($value)]);
        }
        self::clearCache();
    }

    public static function getAll(): array
    {
        $rows = self::all();
        $out = [];
        foreach ($rows as $row) {
            $out[$row->key] = self::unserialize($row->value);
        }
        return $out;
    }

    public static function getAllCached(): array
    {
        return Cache::remember('app_settings', 300, fn () => self::getAll());
    }

    public static function clearCache(): void
    {
        Cache::forget('app_settings');
    }

    protected static function serialize(mixed $value): string
    {
        if (is_bool($value)) {
            return $value ? '1' : '0';
        }
        if (is_array($value) || is_object($value)) {
            return json_encode($value);
        }
        return (string) $value;
    }

    protected static function unserialize(?string $value): mixed
    {
        if ($value === null || $value === '') {
            return null;
        }
        if ($value === '1' || $value === '0') {
            return $value === '1';
        }
        if (is_numeric($value)) {
            return str_contains($value, '.') ? (float) $value : (int) $value;
        }
        $decoded = json_decode($value, true);
        return json_last_error() === JSON_ERROR_NONE ? $decoded : $value;
    }
}
