{!! $heading !!}
@if ($lead)
{!! $lead !!}
@endif
@foreach ($sections as $section)


{!! $section['label'] !!} ({{ count($section['messages']) }})
@foreach ($section['messages'] as $notification)

{!! $notification['title'] !!} ({!! $notification['time'] !!})
@if ($notification['body'])
{!! $notification['body'] !!}
@endif
@if ($notification['url'])
{!! $notification['url'] !!}
@endif
@endforeach
@endforeach
@if ($inboxUrl)


{!! __('View all notifications') !!}: {!! $inboxUrl !!}
@endif


{!! __('You receive this digest because of your notification preferences at :app.', ['app' => config('app.name')]) !!}
@if ($preferencesUrl)
{!! __('Manage your preferences') !!}: {!! $preferencesUrl !!}
@endif
