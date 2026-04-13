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
        'support_phone' => '',
        'support_whatsapp_phone' => '',
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
        'office_checkin_start_time' => '06:00',
        'office_checkin_end_time' => '12:00',
        'office_location_name' => '',
        'office_latitude' => '',
        'office_longitude' => '',
        'office_radius_m' => 100,
        'payment_currency' => 'KES',
        'allow_time_off_requests' => '1',
        /** When false, mobile app hides biometric login (Face ID / fingerprint). */
        'allow_biometric_mobile_login' => '1',
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
