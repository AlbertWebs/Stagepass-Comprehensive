@component('mail::message')
# Your Stagepass account is ready

Hello **{{ $user->name }}**,

An administrator created your **Stagepass** account. Use the credentials below to sign in, then change your password from your profile when you can.

@component('mail::panel')
**Web admin (browser)**  
Email: {{ $user->email }}  
Password: {{ $webPassword }}

@if($user->username)
**Mobile app**  
Username: {{ $user->username }}  
@if($mobilePin !== null && $mobilePin !== '')
PIN: {{ $mobilePin }}
@else
PIN: not set — ask your administrator if you need a PIN for the app.
@endif
@else
**Mobile app:** No username was set yet. Ask your administrator if you need mobile access.
@endif

@if($user->phone)
**Phone on your profile:** {{ $user->phone }}
@endif
@endcomponent

Treat this email like a password: anyone who can read your inbox can use these details. Save your credentials somewhere safe, then delete or archive this message when you are done.

Thanks,<br>
{{ config('mail.from.name', 'Stagepass') }}
@endcomponent
