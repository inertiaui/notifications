<?php

namespace InertiaUI\Notifications\Console;

use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use InertiaUI\Notifications\Console\Concerns\ExplainsHowToEnablePush;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\Models\PushSubscription;
use InertiaUI\Notifications\Push;
use InertiaUI\Notifications\WebPush\PushPayload;
use InertiaUI\Notifications\WebPush\PushResult;
use InertiaUI\Notifications\WebPush\PushSender;
use InertiaUI\Notifications\WebPush\VapidException;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Formatter\OutputFormatter;

/**
 * Sends a test push to every device of a user right away, without the queue, and shows the answer of each push
 * service, with a link to the troubleshooting docs when any push fails. The push opens the application's home page.
 */
#[AsCommand(name: 'inertia-notifications:test-push')]
class TestPushCommand extends Command
{
    use ExplainsHowToEnablePush;

    /**
     * The section of the web push docs with the cause and fix of each failure.
     */
    protected const string TROUBLESHOOTING_URL = 'https://inertiaui.com/inertia-notifications/docs/notification-center/'
        .'web-push#troubleshooting';

    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'inertia-notifications:test-push
                    {user : The key of the user to send the push to}
                    {--model= : The class of the notifiable model, instead of the user model of the default guard}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send a test push to every device of a user, and show how each push service answers';

    /**
     * Execute the console command.
     */
    public function handle(PushSender $sender): int
    {
        if (! Push::enabled()) {
            $this->components->error("Push is not enabled. {$this->enablePushInstruction()}");

            return self::FAILURE;
        }

        $notifiable = $this->findNotifiable();

        if (! $notifiable instanceof Model) {
            return self::FAILURE;
        }

        $subscriptions = PushSubscription::of($notifiable)->oldest('id')->get();

        if ($subscriptions->isEmpty()) {
            $this->components->error(
                "The {$this->describeNotifiable($notifiable)} has no devices that receive pushes.",
            );
            $this->components->bulletList([
                'Sign in as this user in a browser on https:// or localhost.',
                'Turn push on in the notification preferences, and allow notifications when the browser asks.',
            ]);

            return self::FAILURE;
        }

        try {
            $results = $sender->send($subscriptions, $this->payload());
        } catch (VapidException $vapidException) {
            $this->components->error($vapidException->getMessage());

            return self::FAILURE;
        }

        return $this->report(collect($results));
    }

    /**
     * Find the notifiable model of the arguments, or print why it is not found.
     */
    protected function findNotifiable(): ?Model
    {
        $class = $this->notifiableClass();
        $key = (string) $this->argument('user');

        if ($class === null) {
            $this->components->error(
                'The user provider of the default guard has no model. Pass the notifiable model with --model.',
            );

            return null;
        }

        if (! is_subclass_of($class, Model::class)) {
            $this->components->error("The model [{$class}] does not exist. Pass the notifiable model with --model.");

            return null;
        }

        $notifiable = $class::query()->find($key);

        if (! $notifiable instanceof Model) {
            $this->components->error("There is no [{$class}] with the key [{$key}].");

            return null;
        }

        return $notifiable;
    }

    /**
     * Get the class of the notifiable model: the --model option, or else the model of the default guard's user
     * provider, where Laravel's make commands find the user model too.
     */
    protected function notifiableClass(): ?string
    {
        $guard = config('auth.defaults.guard');
        $provider = config("auth.guards.{$guard}.provider");

        return $this->option('model') ?? config("auth.providers.{$provider}.model");
    }

    /**
     * Get the test push, which opens the application's home page.
     */
    protected function payload(): PushPayload
    {
        $id = (string) Str::uuid();
        $name = (string) config('app.name', 'Laravel');

        return new PushPayload(
            id: $id,
            title: "Test push from {$name}",
            body: 'Pushes reach this device. Click to open the application.',
            navigate: url('/'),
            tag: Inbox::toastId($id),
            icon: Push::icon(),
            lang: str_replace('_', '-', app()->getLocale()),
            timestamp: now()->getTimestampMs(),
        );
    }

    /**
     * Print the result of each push, with a link to the causes and fixes of the failures, and get the exit code.
     *
     * @param  Collection<int, PushResult>  $results
     */
    protected function report(Collection $results): int
    {
        $this->table(['Push service', 'Subscribed', 'Result'], $results->map(fn (PushResult $result): array => [
            $result->subscription->host(),
            $result->subscription->created_at->diffForHumans(),
            OutputFormatter::escape($this->describeResult($result)),
        ])->all());

        $delivered = $results->filter(fn (PushResult $result): bool => $result->delivered())->count();

        if ($delivered < $results->count()) {
            $this->components->error("{$delivered} of the {$results->count()} devices accepted the test push.");
            $this->line('  See the cause and fix of each failure: '.self::TROUBLESHOOTING_URL);
            $this->newLine();

            return self::FAILURE;
        }

        $this->components->info(
            'Every device accepted the test push. A device that is offline shows it once it is online again.',
        );

        return self::SUCCESS;
    }

    /**
     * Get the status and the reason of the given result, as the table shows them.
     */
    protected function describeResult(PushResult $result): string
    {
        $status = $result->status === null ? 'Not sent:' : (string) $result->status;

        if ($result->delivered()) {
            return "{$status} Accepted";
        }

        $reason = $result->reason === null ? '' : " {$result->reason}";
        $removed = $result->removed ? ' (removed)' : '';

        return Str::limit("{$status}{$reason}{$removed}", 100);
    }

    /**
     * Get the description of the given notifiable model for the messages.
     */
    protected function describeNotifiable(Model $notifiable): string
    {
        $class = class_basename($notifiable);

        return "[{$class}] with the key [{$notifiable->getKey()}]";
    }
}
