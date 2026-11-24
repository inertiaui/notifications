<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        {{-- Safari on iPhone and iPad only offers web push to a site on the Home Screen with a manifest. Its credentials
             reach a manifest behind a sign-in, such as a development portal. --}}
        <link rel="manifest" href="/manifest.json" crossorigin="use-credentials">
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
        <meta name="theme-color" content="#4338ca">

        <title inertia>{{ config('app.name', 'Laravel') }}</title>

        <script>
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.classList.add('dark');
            }
        </script>

        @if(config('demo.stack') === 'react')
            @viteReactRefresh
            @vite(['resources/js/app.tsx', "resources/js/Pages/{$page['component']}.tsx"])
        @else
            @vite(['resources/js/app.ts', "resources/js/Pages/{$page['component']}.vue"])
        @endif

        @inertiaHead
    </head>
    <body class="bg-gray-50 font-sans text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100">
        @inertia
    </body>
</html>
