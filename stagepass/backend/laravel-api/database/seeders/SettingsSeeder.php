<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingsSeeder extends Seeder
{
    /** Default application and system settings for easy setup */
    public const DEFAULTS = [
        'app_name' => 'Stagepass',
        'company_name' => 'Stagepass',
        'app_support_email' => '',
        'timezone' => 'Africa/Nairobi',
        'date_format' => 'd/m/Y',
        'time_format' => 'H:i',
        'default_geofence_radius_m' => 100,
        'default_event_start_time' => '09:00',
        'default_event_end_time' => '18:00',
        'checkin_allowed_minutes_before' => 60,
        'notifications_email_enabled' => '1',
        'notifications_sms_enabled' => '0',
        'reminder_lead_hours' => 24,
        'default_equipment_condition' => 'good',
        'default_event_status' => 'created',
        'items_per_page' => 20,
        'allow_crew_self_checkin' => '1',
        'require_geofence_for_checkin' => '1',
        'payment_currency' => 'KES',
        'allow_time_off_requests' => '1',
    ];

    public function run(): void
    {
        foreach (self::DEFAULTS as $key => $value) {
            Setting::firstOrCreate(
                ['key' => $key],
                ['value' => is_bool($value) ? ($value ? '1' : '0') : (string) $value]
            );
        }
    }
}
