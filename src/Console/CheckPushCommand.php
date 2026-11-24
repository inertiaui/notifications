<?php

namespace InertiaUI\Notifications\Console;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use InertiaUI\Notifications\Console\Concerns\ExplainsHowToEnablePush;
use InertiaUI\Notifications\Models\PushSubscription;
use InertiaUI\Notifications\Push;
use InertiaUI\Notifications\WebPush\KeyPair;
use InertiaUI\Notifications\WebPush\Vapid;
use InertiaUI\Notifications\WebPush\VapidException;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Formatter\OutputFormatter;
use Symfony\Component\Console\Terminal;
use Throwable;

/**
 * Checks each part of the web push setup, one line per check, and explains how to fix each problem. The command
 * fails when any check fails, so it may also run in a deployment. Warnings point out what still works but often
 * causes trouble later, such as a subject that Apple refuses or a queue that sends pushes during the request.
 */
#[AsCommand(name: 'inertia-notifications:check-push')]
class CheckPushCommand extends Command
{
    use ExplainsHowToEnablePush;

    /**
     * The routes that web push needs, by the name they are registered under.
     *
     * @var list<string>
     */
    protected const array ROUTES = [
        'inertia-notifications.push.subscribe',
        'inertia-notifications.push.unsubscribe',
        'inertia-notifications.push.worker',
        'inertia-notifications.open',
    ];

    /**
     * The fix of a queue connection that does not send the pushes from a worker.
     */
    protected const string QUEUE_FIX = "Set QUEUE_CONNECTION, or the 'connection' of the 'push' section, to a queue "
        .'that a worker runs.';

    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'inertia-notifications:check-push';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Check the setup of web push, and explain how to fix each problem';

    /**
     * The number of checks that failed.
     */
    protected int $failures = 0;

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->failures = 0;

        $this->newLine();

        $this->checkEnabled();

        $keys = $this->checkKeys();

        $this->checkSubject();
        $this->checkApplicationUrl();

        $migrated = $this->checkTable();

        $this->checkRoutes();
        $this->checkQueue();

        if ($migrated) {
            $this->listSubscriptions($keys);
        }

        $this->newLine();

        if ($this->failures > 0) {
            $this->components->error("Web push is not ready: {$this->failures} of the checks failed.");

            return self::FAILURE;
        }

        $this->components->info(
            'Web push is ready. Send a test push with [php artisan inertia-notifications:test-push {user}].',
        );

        return self::SUCCESS;
    }

    /**
     * Check that the application sends pushes.
     */
    protected function checkEnabled(): void
    {
        if (Push::enabled()) {
            $this->printPass('Push enabled');

            return;
        }

        $this->printFailure('Push enabled', $this->enablePushInstruction());
    }

    /**
     * Check that the VAPID keys are set, decode to P-256 keys, and form one pair, and get them.
     */
    protected function checkKeys(): ?KeyPair
    {
        try {
            $keys = Push::keys();
        } catch (VapidException $vapidException) {
            $this->printFailure('VAPID keys', $this->withConfigCacheHint($vapidException->getMessage()));

            return null;
        }

        $publicKey = $keys->publicKeyAsBase64Url();

        $start = substr($publicKey, 0, 8);
        $end = substr($publicKey, -4);

        $this->printPass('VAPID keys', "{$start}…{$end} (one P-256 pair)");

        return $keys;
    }

    /**
     * Check that the VAPID subject is a valid mailto: address or https:// URL, and not on a placeholder domain.
     */
    protected function checkSubject(): void
    {
        try {
            $subject = Push::subject();
        } catch (VapidException $vapidException) {
            $this->printFailure('VAPID subject', $this->withConfigCacheHint($vapidException->getMessage()));

            return;
        }

        if (! Vapid::isWellFormedSubject($subject)) {
            $this->printWarning(
                'VAPID subject',
                'The subject is not a valid email address or https:// URL, so push services may refuse its pushes. '
                    .'Set VAPID_SUBJECT to a valid address or URL, such as [mailto:support@your-app.com].',
                $subject,
            );

            return;
        }

        if (Vapid::hasPlaceholderDomain($subject)) {
            $this->printWarning('VAPID subject', Vapid::PLACEHOLDER_DOMAIN_WARNING, $subject);

            return;
        }

        $this->printPass('VAPID subject', $subject);
    }

    /**
     * Check that the application's URL is a secure context, since browsers only offer push in one.
     */
    protected function checkApplicationUrl(): void
    {
        $url = (string) config('app.url');
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));

        if (str_starts_with($url, 'https://')) {
            $this->printPass('Application URL', $url);

            return;
        }

        if (in_array($host, ['localhost', '127.0.0.1', '[::1]'], true) || str_ends_with($host, '.localhost')) {
            $this->printPass('Application URL', "{$url} (browsers allow push on localhost)");

            return;
        }

        $this->printFailure(
            'Application URL',
            "Browsers only offer push on https:// pages and on localhost, and pushes link to APP_URL [{$url}]. "
                .'Serve the application over https://, such as with [herd secure] or [valet secure], and set '
                .'APP_URL to that URL.',
        );
    }

    /**
     * Check that the table of the subscriptions exists.
     */
    protected function checkTable(): bool
    {
        $table = (new PushSubscription)->getTable();

        try {
            $exists = Schema::hasTable($table);
        } catch (Throwable $throwable) {
            $this->printFailure('Subscriptions table', "The database could not be reached: {$throwable->getMessage()}");

            return false;
        }

        if ($exists) {
            $this->printPass('Subscriptions table', $table);

            return true;
        }

        $this->printFailure(
            'Subscriptions table',
            "The [{$table}] table does not exist. Publish its migration with "
                .'[php artisan vendor:publish --tag=inertia-notifications-migrations], then run [php artisan migrate].',
        );

        return false;
    }

    /**
     * Check that the routes of web push are registered.
     */
    protected function checkRoutes(): void
    {
        $missing = collect(self::ROUTES)->reject(fn (string $name): bool => Route::has($name));

        if ($missing->isEmpty()) {
            $this->printPass('Routes', route(Push::WORKER_ROUTE, absolute: false));

            return;
        }

        $fix = 'Register the routes with [Route::inertiaNotifications()] in routes/web.php';

        if ($this->laravel->routesAreCached()) {
            $fix .= ', then run [php artisan route:cache], since your routes are cached';
        }

        $names = $missing->map(fn (string $name): string => "[{$name}]")->implode(', ');

        $this->printFailure('Routes', "{$fix}. Missing: {$names}.");
    }

    /**
     * Check that the queue connection of the pushes is configured and keeps its jobs, and warn when it sends
     * the pushes during the request that sends the notification.
     */
    protected function checkQueue(): void
    {
        $connection = Push::connection() ?? (string) config('queue.default');
        $fix = self::QUEUE_FIX;

        if (! is_array(config("queue.connections.{$connection}"))) {
            $this->printFailure(
                'Queue',
                "The [{$connection}] connection is not in config/queue.php, so queueing each push throws. {$fix}",
            );

            return;
        }

        $driver = config("queue.connections.{$connection}.driver");

        if ($driver === 'null') {
            $this->printFailure(
                'Queue',
                "The [{$connection}] connection uses the [null] driver, which discards every job, "
                    ."so no push is sent. {$fix}",
            );

            return;
        }

        if ($driver !== 'sync') {
            $this->printPass('Queue', "the [{$connection}] connection, run by [php artisan queue:work]");

            return;
        }

        $this->printWarning(
            'Queue',
            "The [{$connection}] connection sends each push during the request that sends the notification, "
                ."which then waits for every push service. {$fix}",
            $connection,
        );
    }

    /**
     * List the number of subscriptions of each push service, and those that the current keys can't reach.
     *
     * The subscriptions are counted by the host of the `push.hosts` config that they match, since some push
     * services, such as the one of Edge, give each device a host of its own.
     */
    protected function listSubscriptions(?KeyPair $keys): void
    {
        $hosts = [];
        $subscriptionsWithOtherKey = 0;
        $publicKey = $keys?->publicKeyAsBase64Url();

        $subscriptions = PushSubscription::query()->select(['id', 'endpoint', 'vapid_public_key'])->lazyById();

        foreach ($subscriptions as $subscription) {
            $service = Push::hostPatternOf($subscription->host()) ?? $subscription->host();
            $hosts[$service] = ($hosts[$service] ?? 0) + 1;

            if ($publicKey !== null && ! $subscription->madeWith($publicKey)) {
                $subscriptionsWithOtherKey++;
            }
        }

        $this->newLine();
        $this->components->twoColumnDetail('<fg=green;options=bold>Subscriptions</>', '<fg=gray>Devices</>');

        if ($hosts === []) {
            $this->printFix('No browser has subscribed yet. Turn push on in the notification preferences of your '
                .'application, in a browser on https:// or localhost.', 'gray');

            return;
        }

        ksort($hosts);

        foreach ($hosts as $host => $count) {
            $this->components->twoColumnDetail($host, (string) $count);
        }

        if ($subscriptionsWithOtherKey > 0) {
            $this->printFix("{$subscriptionsWithOtherKey} of them subscribed with another VAPID public key, and "
                .'receive no pushes until their user opens your application on that device again.', 'yellow');
        }
    }

    /**
     * Get the given fix with a reminder to cache the configuration again, when it is cached.
     */
    protected function withConfigCacheHint(string $fix): string
    {
        if (! $this->laravel->configurationIsCached()) {
            return $fix;
        }

        return "{$fix} Your configuration is cached, so run [php artisan config:cache] after changing it.";
    }

    /**
     * Print a check that passed, with the given detail.
     */
    protected function printPass(string $check, ?string $detail = null): void
    {
        $detail = $detail === null ? '' : '<fg=gray>'.OutputFormatter::escape($detail).'</> ';

        $this->components->twoColumnDetail($check, "{$detail}<fg=green;options=bold>OK</>");
    }

    /**
     * Print a check that failed, with the way to fix it.
     */
    protected function printFailure(string $check, string $fix): void
    {
        $this->failures++;

        $this->components->twoColumnDetail($check, '<fg=red;options=bold>FAIL</>');
        $this->printFix($fix, 'red');
    }

    /**
     * Print a check that passed with a warning, with the way to avoid the problem.
     */
    protected function printWarning(string $check, string $fix, ?string $detail = null): void
    {
        $detail = $detail === null ? '' : '<fg=gray>'.OutputFormatter::escape($detail).'</> ';

        $this->components->twoColumnDetail($check, "{$detail}<fg=yellow;options=bold>WARN</>");
        $this->printFix($fix, 'yellow');
    }

    /**
     * Print the given fix below its check, wrapped to the width of the terminal, with its [values] in bold.
     */
    protected function printFix(string $fix, string $color): void
    {
        $width = max(60, min(120, (new Terminal)->getWidth()) - 6);

        // A command in brackets should stay on one line, so it can be copied, so we will keep its spaces
        // from wrapping and bring them back once the fix is wrapped, before the brackets are made bold.
        $fix = (string) preg_replace_callback(
            '/\[[^\]]+\]/',
            fn (array $matches): string => str_replace(' ', "\x1F", $matches[0]),
            $fix,
        );

        foreach (explode("\n", wordwrap($fix, $width)) as $index => $line) {
            $marker = $index === 0 ? "<fg={$color}>⇂</>" : ' ';
            $line = (string) preg_replace('/\[[^\]]+\]/', '<options=bold>$0</>', OutputFormatter::escape($line));

            $this->line("  {$marker} ".str_replace("\x1F", ' ', $line));
        }
    }
}
