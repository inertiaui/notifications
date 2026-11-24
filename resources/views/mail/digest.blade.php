<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>{{ $subject }}</title>
<style>
    body, table, td, h1, p, a { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    img { border: 0; outline: none; text-decoration: none; }

    @media (max-width: 600px) {
        .digest-outer { padding: 24px 12px !important; }
        .digest-card { padding: 28px 20px !important; }
    }

    @media (prefers-color-scheme: dark) {
        .digest-page { background-color: #09090b !important; }
        .digest-card { background-color: #18181b !important; border-color: #27272a !important; }
        .digest-strong { color: #fafafa !important; }
        .digest-text { color: #d4d4d8 !important; }
        .digest-muted { color: #a1a1aa !important; }
        .digest-rule { border-color: #3f3f46 !important; }
        .digest-divider { border-color: #27272a !important; }
        .digest-initials { background-color: #27272a !important; color: #d4d4d8 !important; }
        .digest-button { background-color: #fafafa !important; }
        .digest-button-link { color: #18181b !important; }
    }
</style>
</head>
<body class="digest-page" style="margin: 0; padding: 0; background-color: #f4f4f5; -webkit-text-size-adjust: 100%;">
<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">{{ $lead ?? $heading }}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="digest-page" style="background-color: #f4f4f5;">
<tr>
<td align="center" class="digest-outer" style="padding: 40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">
<tr>
<td style="padding: 0 4px 16px; font-size: 15px; line-height: 22px; font-weight: 600;">
<a href="{{ url('/') }}" class="digest-strong" style="color: #18181b; text-decoration: none;">{{ config('app.name') }}</a>
</td>
</tr>
<tr>
<td class="digest-card" style="padding: 40px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 12px;">
<h1 class="digest-strong" style="margin: 0; font-size: 24px; line-height: 32px; font-weight: 600; letter-spacing: -0.3px; color: #18181b;">{{ $heading }}</h1>
@if ($lead)
<p class="digest-text" style="margin: 8px 0 0; font-size: 16px; line-height: 26px; color: #3f3f46;">{{ $lead }}</p>
@endif
@foreach ($sections as $section)
@php($media = collect($section['messages'])->contains(fn ($notification) => $notification['avatar'] || $notification['initials']))
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="padding-top: 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td class="digest-strong digest-rule" style="padding-bottom: 10px; border-bottom: 1px solid #d4d4d8; font-size: 18px; line-height: 26px; font-weight: 600; letter-spacing: -0.2px; color: #18181b;">{{ $section['label'] }}</td>
<td align="right" class="digest-muted digest-rule" style="padding-bottom: 10px; border-bottom: 1px solid #d4d4d8; font-size: 14px; line-height: 26px; color: #71717a;">{{ count($section['messages']) }}</td>
</tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
@foreach ($section['messages'] as $notification)
<tr>
@if ($media)
<td width="36" valign="top" style="width: 36px; padding: 16px 14px 16px 0;">
@if ($notification['avatar'])
<img src="{{ $notification['avatar'] }}" alt="" width="36" height="36" style="display: block; width: 36px; height: 36px; border-radius: 18px; object-fit: cover;">
@elseif ($notification['initials'])
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" valign="middle" width="36" height="36" class="digest-initials" style="width: 36px; height: 36px; border-radius: 18px; background-color: #f4f4f5; color: #52525b; font-size: 13px; line-height: 36px; font-weight: 600;">{{ $notification['initials'] }}</td>
</tr>
</table>
@endif
</td>
@endif
<td valign="top" class="digest-divider" style="padding: 16px 0;{{ $loop->first ? '' : ' border-top: 1px solid #e9e9ec;' }}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td valign="top" class="digest-strong" style="font-size: 15px; line-height: 22px; font-weight: 600; color: #18181b;">
@if ($notification['url'])
<a href="{{ $notification['url'] }}" class="digest-strong" style="color: #18181b; text-decoration: none;">{{ $notification['title'] }}</a>
@else
{{ $notification['title'] }}
@endif
</td>
<td align="right" valign="top" class="digest-muted" style="padding-left: 16px; font-size: 13px; line-height: 22px; color: #71717a; white-space: nowrap;">{{ $notification['time'] }}</td>
</tr>
</table>
@if ($notification['body'])
<p class="digest-text" style="margin: 2px 0 0; font-size: 14px; line-height: 22px; color: #52525b;">{{ $notification['body'] }}</p>
@endif
@if ($notification['image'])
<img src="{{ $notification['image'] }}" alt="" width="160" style="display: block; width: 160px; max-width: 100%; height: auto; margin-top: 12px; border-radius: 8px;">
@endif
</td>
</tr>
@endforeach
</table>
</td>
</tr>
</table>
@endforeach
@if ($inboxUrl)
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="padding-top: 24px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td class="digest-button" style="border-radius: 8px; background-color: #18181b;">
<a href="{{ $inboxUrl }}" class="digest-button-link" style="display: inline-block; padding: 12px 20px; font-size: 14px; line-height: 20px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">{{ __('View all notifications') }}</a>
</td>
</tr>
</table>
</td>
</tr>
</table>
@endif
</td>
</tr>
<tr>
<td class="digest-muted" style="padding: 24px 4px 0; font-size: 13px; line-height: 20px; color: #52525b;">
{{ __('You receive this digest because of your notification preferences at :app.', ['app' => config('app.name')]) }}
@if ($preferencesUrl)
<a href="{{ $preferencesUrl }}" class="digest-muted" style="color: #52525b; text-decoration: underline;">{{ __('Manage your preferences') }}</a>
@endif
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>
