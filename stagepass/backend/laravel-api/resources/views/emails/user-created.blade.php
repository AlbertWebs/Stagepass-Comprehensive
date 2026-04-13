@component('mail::message')
@if($isResend)
# Stagepass — sign-in details

Hello **{{ $user->name }}**,

An administrator sent you this email from **Stagepass** with your account details and any password or PIN updates they applied at the same time.
@else
# Your Stagepass account is ready

Hello **{{ $user->name }}**,

An administrator created your **Stagepass** account. Use the credentials below to sign in, then change your password from your profile when you can.
@endif

@component('mail::panel')
**Web admin (browser)**  
Email: {{ $user->email }}  
@if($webPassword !== null && $webPassword !== '')
Password: {{ $webPassword }}
@else
Password: *(not shown — unchanged.)* Use **Forgot password** on the web sign-in page if you need a new password.
@endif

@if($user->username)
**Mobile app**  
Username: {{ $user->username }}  
@if($mobilePin !== null && $mobilePin !== '')
PIN: {{ $mobilePin }}
@else
PIN: *(not shown — unchanged.)* Ask your administrator if you need your PIN reset.
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
