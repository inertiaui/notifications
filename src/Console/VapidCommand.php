<?php

namespace InertiaUI\Notifications\Console;

use Illuminate\Console\Command;
use Illuminate\Console\ConfirmableTrait;
use Illuminate\Console\View\Components\Mutators\EnsureDynamicContentIsHighlighted;
use Illuminate\Filesystem\Filesystem;
use Illuminate\Support\Env;
use Illuminate\Support\Facades\Schema;
use InertiaUI\Notifications\Console\Concerns\ExplainsHowToEnablePush;
use InertiaUI\Notifications\Models\PushSubscription;
use InertiaUI\Notifications\Push;
use InertiaUI\Notifications\WebPush\KeyPair;
use InertiaUI\Notifications\WebPush\Vapid;

use function Laravel\Prompts\text;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Formatter\OutputFormatter;
use Throwable;

/**
 * Generates the VAPID keys of web push and writes them to the .env file with Laravel's `Env::writeVariables()`,
 * together with the subject where push services may reach the application.
 */
#[AsCommand(name: 'inertia-notifications:vapid')]
class VapidCommand extends Command
{
    use ConfirmableTrait, ExplainsHowToEnablePush;

    /**
     * The variables of the .env file that hold the keys and the subject.
     */
    protected const array VARIABLES = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'];

    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'inertia-notifications:vapid
                    {--subject= : The mailto: address or https:// URL where push services may reach you}
                    {--show : Display the keys instead of writing them to the .env file}
                    {--force : Replace the existing keys, and skip the confirmation in production}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Generate the VAPID keys of web push and write them to the .env file';

    /**
     * Execute the console command.
     */
    public function handle(Filesystem $files): int
    {
        $keys = KeyPair::generate();

        if ($this->option('show')) {
            $this->showKeys($keys);

            return self::SUCCESS;
        }

        $path = $this->laravel->environmentFilePath();

        if (! $files->exists($path)) {
            $this->components->error("There is no .env file at [{$path}]. Create it, or display the keys with --show.");

            return self::FAILURE;
        }

        if ($this->hasKeys($files, $path) && ! $this->option('force')) {
            $this->printKeysAreSet();

            return self::FAILURE;
        }

        if (! $this->confirmToProceed()) {
            return self::FAILURE;
        }

        $subject = $this->resolveSubject();

        if ($subject === null) {
            return self::FAILURE;
        }

        $this->writeKeys($files, $path, $keys, $subject);
        $this->printNextSteps();

        return self::SUCCESS;
    }

    /**
     * Display the given keys without writing them.
     */
    protected function showKeys(KeyPair $keys): void
    {
        $this->line("<comment>VAPID_PUBLIC_KEY={$keys->publicKeyAsBase64Url()}</comment>");
        $this->line("<comment>VAPID_PRIVATE_KEY={$keys->privateKeyAsBase64Url()}</comment>");
    }

    /**
     * Print that the keys are already set, and what replacing them means for the devices that subscribed.
     */
    protected function printKeysAreSet(): void
    {
        $this->components->error('The VAPID keys are already set.');

        $this->components->bulletList([
            'Every browser subscribed with the current public key, and push services refuse the pushes of a new one.',
            'After you replace the keys, each device gets no pushes until its user opens your application on it again.',
            'Run the command with --force to replace them anyway.',
        ]);
    }

    /**
     * Determine if the application or its .env file has VAPID keys.
     */
    protected function hasKeys(Filesystem $files, string $path): bool
    {
        $configured = filled(config('inertia-notifications.push.public_key'))
            || filled(config('inertia-notifications.push.private_key'));

        if ($configured) {
            return true;
        }

        $contents = $files->get($path);

        return filled($this->environmentValue($contents, 'VAPID_PUBLIC_KEY'))
            || filled($this->environmentValue($contents, 'VAPID_PRIVATE_KEY'));
    }

    /**
     * Get the subject of the keys, or null when there is none to use.
     *
     * The subject is the --subject option or the subject that is already set. Without one, we will ask
     * for it. Only the option may be a subject on a placeholder domain, such as example.com, which is
     * written with a warning.
     */
    protected function resolveSubject(): ?string
    {
        $subject = $this->option('subject') ?? $this->currentSubject();

        if ($subject === null && $this->input->isInteractive()) {
            $subject = $this->askForSubject();
        }

        if ($subject === null) {
            $this->components->error(
                'Pass the address where push services may reach you, such as [--subject=mailto:you@your-app.com].',
            );

            return null;
        }

        $subject = $this->normalizeSubject((string) $subject);
        $error = $this->unwritableSubjectError($subject);

        if ($error !== null) {
            $this->components->error($error);

            return null;
        }

        if (! Vapid::isWellFormedSubject($subject)) {
            $this->components->error("The subject [{$subject}] must be a mailto: address or an https:// URL.");

            return null;
        }

        if (Vapid::hasPlaceholderDomain($subject)) {
            $this->components->warn(Vapid::PLACEHOLDER_DOMAIN_WARNING);
        }

        return $subject;
    }

    /**
     * Get the subject that the application already has, when it is valid and not on a placeholder domain.
     */
    protected function currentSubject(): ?string
    {
        $subject = config('inertia-notifications.push.subject');

        if (! is_string($subject) || ! Vapid::isWellFormedSubject($subject)) {
            return null;
        }

        return Vapid::hasPlaceholderDomain($subject) ? null : $subject;
    }

    /**
     * Ask for the address where push services may reach the application.
     */
    protected function askForSubject(): string
    {
        return text(
            label: 'Which email address may push services contact you at?',
            placeholder: 'you@your-app.com',
            default: $this->mailAddress(),
            required: true,
            validate: fn (string $value): ?string => $this->validateAnswer($this->normalizeSubject($value)),
            hint: 'Push services write to it when your pushes cause problems. Apple refuses example.com and localhost.',
        );
    }

    /**
     * Get the error of the given answer to the question for the subject, or null when the subject may be used.
     */
    protected function validateAnswer(string $subject): ?string
    {
        $error = $this->unwritableSubjectError($subject);

        if ($error !== null) {
            return $error;
        }

        if (! Vapid::isWellFormedSubject($subject)) {
            return 'Enter an email address, or a mailto: or https:// URL.';
        }

        if (Vapid::hasPlaceholderDomain($subject)) {
            return 'Enter an address on a domain you own. Apple refuses example.com and localhost.';
        }

        return null;
    }

    /**
     * Get the address that the application sends mail from, unless it is on a placeholder domain.
     *
     * A new Laravel application sends its mail from hello@example.com, which nobody reads.
     */
    protected function mailAddress(): string
    {
        $address = config('mail.from.address');

        if (! is_string($address) || Vapid::hasPlaceholderDomain("mailto:{$address}")) {
            return '';
        }

        return $address;
    }

    /**
     * Get the error of a subject that the .env file cannot hold, or null when it can hold the subject.
     *
     * Laravel writes the value in double quotes, or in single quotes when it has a double quote, and leaves its
     * dollar signs as they are. Dotenv would therefore replace a ${NAME} in it with the value of another variable,
     * and it cannot read a value with both kinds of quotes.
     */
    protected function unwritableSubjectError(string $subject): ?string
    {
        if (str_contains($subject, '${')) {
            return "The subject [{$subject}] may not contain \${, because the .env file would read it as a "
                .'reference to another variable.';
        }

        if (str_contains($subject, "'") && str_contains($subject, '"')) {
            return "The subject [{$subject}] may not contain both a single and a double quote, because the .env "
                .'file cannot hold a value with both.';
        }

        return null;
    }

    /**
     * Get the given subject with mailto: in front of a plain email address.
     */
    protected function normalizeSubject(string $subject): string
    {
        $subject = trim($subject);

        if (! str_contains($subject, ':') && filter_var($subject, FILTER_VALIDATE_EMAIL) !== false) {
            return "mailto:{$subject}";
        }

        return $subject;
    }

    /**
     * Write the keys and the subject to the .env file, and add empty entries to the .env.example file.
     */
    protected function writeKeys(Filesystem $files, string $path, KeyPair $keys, string $subject): void
    {
        $values = [
            'VAPID_PUBLIC_KEY' => $keys->publicKeyAsBase64Url(),
            'VAPID_PRIVATE_KEY' => $keys->privateKeyAsBase64Url(),
            'VAPID_SUBJECT' => $subject,
        ];

        // The command only gets here when the keys are not set yet, or with --force, so we will replace the
        // variables that the file has, such as a subject that differs from the option.
        Env::writeVariables($values, $path, overwrite: true);

        $example = $this->laravel->environmentPath().'/.env.example';

        if ($files->exists($example)) {
            Env::writeVariables(array_fill_keys(self::VARIABLES, ''), $example);
        }

        // The rest of this command, and the commands that run after it in the same process,
        // should use the new keys, as key:generate does with the application key.
        config([
            'inertia-notifications.push.public_key' => $values['VAPID_PUBLIC_KEY'],
            'inertia-notifications.push.private_key' => $values['VAPID_PRIVATE_KEY'],
            'inertia-notifications.push.subject' => $subject,
        ]);

        $file = basename($path);

        $this->components->info("The VAPID keys are written to the [{$file}] file.");

        $this->components->twoColumnDetail('VAPID_PUBLIC_KEY', $values['VAPID_PUBLIC_KEY']);
        $this->components->twoColumnDetail('VAPID_SUBJECT', OutputFormatter::escape($subject));
    }

    /**
     * Get the value of the given variable in the given contents of an environment file.
     */
    protected function environmentValue(string $contents, string $name): ?string
    {
        if (preg_match('/^'.preg_quote($name, '/').'=(.*)$/m', $contents, $matches) !== 1) {
            return null;
        }

        return trim($matches[1], " \t\"'");
    }

    /**
     * Print the steps that remain to send pushes, leaving out the ones that are done.
     */
    protected function printNextSteps(): void
    {
        if ($this->laravel->configurationIsCached()) {
            $this->components->warn('Your configuration is cached. Run [php artisan config:cache] to load the keys.');
        }

        $steps = $this->nextSteps();

        $this->components->info('Next steps');

        foreach ($steps as $index => [$instruction, $commands]) {
            $number = $index + 1;

            // The steps print with line() instead of the components, so we will bold their bracketed commands and
            // options ourselves, as the components do, such as the instruction that enables push.
            $instruction = (new EnsureDynamicContentIsHighlighted)($instruction);

            $this->line("  <options=bold>{$number}.</> {$instruction}");

            foreach ($commands as $command) {
                $this->line("        <options=bold>{$command}</>");
            }
        }

        $this->newLine();
    }

    /**
     * Get the steps that remain to send pushes, each an instruction and the commands to run for it.
     *
     * @return list<array{string, list<string>}>
     */
    protected function nextSteps(): array
    {
        $steps = [];

        if (! Push::enabled()) {
            $steps[] = [$this->enablePushInstruction(), []];
        }

        if (! $this->tableExists()) {
            $steps[] = ['Publish and run the migration of the subscriptions:', [
                'php artisan vendor:publish --tag=inertia-notifications-migrations',
                'php artisan migrate',
            ]];
        }

        $steps[] = ['Call <options=bold>->push()</> on the toInbox() message of your notifications.', []];
        $steps[] = ['Check the setup: <options=bold>php artisan inertia-notifications:check-push</>', []];

        return $steps;
    }

    /**
     * Determine if the table of the subscriptions exists.
     */
    protected function tableExists(): bool
    {
        try {
            return Schema::hasTable((new PushSubscription)->getTable());
        } catch (Throwable) {
            return false;
        }
    }
}
