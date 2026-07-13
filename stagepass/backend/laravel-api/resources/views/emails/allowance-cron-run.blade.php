@component('mail::message')
# Allowance cron — {{ strtoupper($status) }}

The `allowances:process-meals` command finished.

@component('mail::panel')
**Status:** {{ strtoupper($status) }}  
**Time (app timezone):** {{ $sentAt->format('l, j F Y H:i:s T') }}  
**Meal allowances granted (this run):** {{ $grantedCount }}  
**App:** {{ $appName }}  
**URL:** {{ $appUrl }}  
**Timezone:** {{ $timezone }}  
@if($hostname)
**Server:** {{ $hostname }}
@endif
@if($errorMessage)
**Error:** {{ $errorMessage }}
@endif
@endcomponent

## Slot results

@forelse($slotResults as $slot)
- **{{ $slot['label'] }}** ({{ $slot['scheduled_time'] }}): {{ $slot['due_this_minute'] ? 'due this minute' : 'not due' }} — **{{ $slot['granted'] }}** granted
@empty
No slot results recorded (command may have failed before processing).
@endforelse

Thanks,<br>
{{ $appName }}
@endcomponent
