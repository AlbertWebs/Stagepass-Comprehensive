@props(['url'])
<tr>
<td class="header">
<a href="{{ $url ?? config('app.url') }}" style="display: inline-block; color: #ffffff;">
@if (trim($slot) === 'Laravel' || trim($slot) === config('app.name'))
<span style="color: #ffffff; font-weight: 800;">Stage</span><span class="accent" style="color: #eab308;">pass</span>
@else
{!! $slot !!}
@endif
</a>
</td>
</tr>
