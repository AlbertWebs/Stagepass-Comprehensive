@component('mail::message')
# Allowance cron ran

The `allowances:process-meals` command completed successfully.

@component('mail::panel')
**Time (app timezone):** {{ $sentAt->format('l, j F Y H:i:s T') }}  
**Meal allowances granted:** {{ $grantedCount }}  
**App:** {{ $appName }}  
**URL:** {{ $appUrl }}  
**Timezone:** {{ $timezone }}  
@if($hostname)
**Server:** {{ $hostname }}
@endif
@endcomponent

Thanks,<br>
{{ $appName }}
@endcomponent
