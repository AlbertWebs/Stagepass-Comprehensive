@component('mail::message')
# Cron heartbeat

The Laravel scheduler ran successfully and sent this test email.

@component('mail::panel')
**Time (app timezone):** {{ $sentAt->format('l, j F Y H:i:s T') }}  
**App:** {{ $appName }}  
**URL:** {{ $appUrl }}  
**Timezone:** {{ $timezone }}  
@if($hostname)
**Server:** {{ $hostname }}
@endif
@endcomponent

If you receive one of these every minute, cPanel cron and `php artisan schedule:run` are working.

Disable when finished testing: set `CRON_TEST_EMAIL_ENABLED=false` in `.env`, then `php artisan config:clear`.

Thanks,<br>
{{ $appName }}
@endcomponent
