@component('mail::message')
# Welcome to Stagepass

Hello **{{ $user->name }}**,

Your Stagepass account has been created. You can now sign in and manage your events and schedule.

@if($user->email)
**Sign in (web):** Use your email and the password set by your administrator.
@endif

@if($user->username)
**Sign in (mobile app):** Use username **{{ $user->username }}** and your PIN.
@endif

@if($temporaryPassword)
We've set a temporary password for you. Please change it after your first login.
@endif

Thanks,<br>
**Stagepass**
@endcomponent
