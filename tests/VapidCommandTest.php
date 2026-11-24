<?php

use Dotenv\Dotenv;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use InertiaUI\Notifications\WebPush\KeyPair;
use Laravel\Prompts\Prompt;

beforeEach(function (): void {
    $this->environmentPath = sys_get_temp_dir().'/inertiaui-vapid-'.Str::random(8);

    File::ensureDirectoryExists($this->environmentPath);

    // The command writes the .env file of the environment path, so the tests point it at a temporary directory
    // and never write the .env file of the package or of the application skeleton.
    $this->app->useEnvironmentPath($this->environmentPath);

    config(['inertia-notifications.push.subject' => 'mailto:support@acme.test']);
});

afterEach(function (): void {
    File::deleteDirectory($this->environmentPath);
});

/**
 * Get the path of the given file in the temporary environment path.
 */
function environmentFile(string $name = '.env'): string
{
    return test()->environmentPath.'/'.$name;
}

/**
 * Get the variables of the given environment file, as Laravel reads them.
 *
 * @return array<string, string|null>
 */
function environmentVariables(string $name = '.env'): array
{
    return Dotenv::parse(File::get(environmentFile($name)));
}

it('writes a new pair of keys and the subject to the .env file', function (): void {
    File::put(environmentFile(), <<<'ENV'
        APP_NAME=Acme
        APP_KEY=base64:abc

        ENV);

    $this->artisan('inertia-notifications:vapid')
        ->expectsOutputToContain('The VAPID keys are written to the [.env] file.')
        ->assertSuccessful();

    $variables = environmentVariables();
    $keys = KeyPair::fromBase64Url($variables['VAPID_PUBLIC_KEY'], $variables['VAPID_PRIVATE_KEY']);

    expect($keys->belongTogether())
        ->toBeTrue()
        ->and($variables)
        ->toMatchArray([
            'APP_NAME' => 'Acme',
            'APP_KEY' => 'base64:abc',
            'VAPID_SUBJECT' => 'mailto:support@acme.test',
        ])
        ->and(config('inertia-notifications.push.public_key'))
        ->toBe($variables['VAPID_PUBLIC_KEY'])
        ->and(config('inertia-notifications.push.private_key'))
        ->toBe($variables['VAPID_PRIVATE_KEY']);
});

it('fills the empty entries of the .env file in place', function (): void {
    File::put(environmentFile(), <<<'ENV'
        VAPID_PUBLIC_KEY=
        VAPID_PRIVATE_KEY=
        VAPID_SUBJECT=
        MAIL_MAILER=log

        ENV);

    $this->artisan('inertia-notifications:vapid')->assertSuccessful();

    $lines = explode("\n", trim(File::get(environmentFile())));

    // Laravel quotes each value with characters other than letters and digits, which a random key may lack.
    expect($lines)
        ->toHaveCount(4)
        ->and($lines[0])
        ->toMatch('/^VAPID_PUBLIC_KEY=("?)B[A-Za-z0-9_-]{86}\1$/')
        ->and($lines[1])
        ->toMatch('/^VAPID_PRIVATE_KEY=("?)[A-Za-z0-9_-]{43}\1$/')
        ->and($lines[2])
        ->toBe('VAPID_SUBJECT="mailto:support@acme.test"')
        ->and($lines[3])
        ->toBe('MAIL_MAILER=log');
});

it('adds empty entries to the .env.example file, and keeps the values it has', function (): void {
    File::put(environmentFile(), "APP_NAME=Acme\n");
    File::put(environmentFile('.env.example'), <<<'ENV'
        APP_NAME=Laravel
        VAPID_SUBJECT=mailto:you@your-app.com

        ENV);

    $this->artisan('inertia-notifications:vapid')->assertSuccessful();

    expect(environmentVariables('.env.example'))->toBe([
        'APP_NAME' => 'Laravel',
        'VAPID_SUBJECT' => 'mailto:you@your-app.com',
        'VAPID_PUBLIC_KEY' => '',
        'VAPID_PRIVATE_KEY' => '',
    ]);
});

it('refuses to replace keys that are already set, and explains why', function (string $contents, array $config): void {
    File::put(environmentFile(), $contents);
    config($config);

    $status = Artisan::call('inertia-notifications:vapid');

    expect($status)
        ->toBe(1)
        ->and(Artisan::output())
        ->toContain('The VAPID keys are already set.')
        ->toContain('Every browser subscribed with the current public key, and push services refuse the pushes of a new one')
        ->toContain('After you replace the keys, each device gets no pushes until its user opens your application on it again')
        ->toContain('Run the command with --force to replace them anyway')
        ->and(File::get(environmentFile()))
        ->toBe($contents);
})->with([
    'in the .env file' => [
        <<<'ENV'
            VAPID_PUBLIC_KEY=BPublic
            VAPID_PRIVATE_KEY=private

            ENV,
        [],
    ],
    'in the config, such as from the server' => ["APP_NAME=Acme\n", ['inertia-notifications.push.public_key' => 'BPublic']],
]);

it('replaces the keys with --force, and keeps the subject', function (): void {
    File::put(environmentFile(), <<<'ENV'
        VAPID_PUBLIC_KEY=BPublic
        VAPID_PRIVATE_KEY=private
        VAPID_SUBJECT=mailto:ops@acme.test

        ENV);
    config([
        'inertia-notifications.push.public_key' => 'BPublic',
        'inertia-notifications.push.subject' => 'mailto:ops@acme.test',
    ]);

    $this->artisan('inertia-notifications:vapid', ['--force' => true])->assertSuccessful();

    expect(environmentVariables())
        ->VAPID_PUBLIC_KEY->not->toBe('BPublic')
        ->VAPID_PRIVATE_KEY->not->toBe('private')
        ->VAPID_SUBJECT->toBe('mailto:ops@acme.test');
});

it('only displays the keys with --show', function (): void {
    $this->artisan('inertia-notifications:vapid', ['--show' => true])
        ->expectsOutputToContain('VAPID_PUBLIC_KEY=B')
        ->expectsOutputToContain('VAPID_PRIVATE_KEY=')
        ->assertSuccessful();

    expect(environmentFile())->not->toBeFile();
});

it('fails without a .env file', function (): void {
    $this->artisan('inertia-notifications:vapid')
        ->expectsOutputToContain('There is no .env file at')
        ->assertFailed();
});

it('writes the subject of the option, with mailto: in front of a plain address', function (string $subject, string $written): void {
    File::put(environmentFile(), "APP_NAME=Acme\n");

    $this->artisan('inertia-notifications:vapid', ['--subject' => $subject])->assertSuccessful();

    expect(environmentVariables()['VAPID_SUBJECT'])->toBe($written);
})->with([
    'an address' => ['push@acme.test', 'mailto:push@acme.test'],
    'a mailto: URL' => ['mailto:push@acme.test', 'mailto:push@acme.test'],
    'an https:// URL' => ['https://acme.test/contact', 'https://acme.test/contact'],
    'an https:// URL with a dollar sign' => ['https://acme.test/contact?via=$push', 'https://acme.test/contact?via=$push'],
]);

it('refuses a subject that the .env file cannot hold, before writing anything', function (string $subject, string $reason): void {
    File::put(environmentFile(), "APP_NAME=Acme\n");
    File::put(environmentFile('.env.example'), "APP_NAME=Laravel\n");

    $status = Artisan::call('inertia-notifications:vapid', ['--subject' => $subject]);

    expect($status)
        ->toBe(1)
        ->and(preg_replace('/\s+/', ' ', Artisan::output()))
        ->toContain($reason)
        ->and(File::get(environmentFile()))
        ->toBe("APP_NAME=Acme\n")
        ->and(File::get(environmentFile('.env.example')))
        ->toBe("APP_NAME=Laravel\n");
})->with([
    'a reference to another variable' => [
        'mailto:push${APP_NAME}@acme.test',
        'may not contain ${, because the .env file would read it as a reference to another variable.',
    ],
    'an escaped reference to another variable' => [
        'https://acme.test/\${APP_NAME}',
        'may not contain ${, because the .env file would read it as a reference to another variable.',
    ],
    'both kinds of quotes' => [
        'mailto:"push\'s"@acme.test',
        'may not contain both a single and a double quote, because the .env file cannot hold a value with both.',
    ],
]);

it('refuses an answer that the .env file cannot hold', function (): void {
    File::put(environmentFile(), "APP_NAME=Acme\n");
    config(['inertia-notifications.push.subject' => null]);

    $this->artisan('inertia-notifications:vapid')
        ->expectsQuestion('Which email address may push services contact you at?', 'push${APP_NAME}@acme.test')
        ->expectsOutputToContain('would read it as a reference to another variable')
        ->assertFailed();

    expect(File::get(environmentFile()))->toBe("APP_NAME=Acme\n");
});

it('refuses a subject that is not a mailto: or https:// URL', function (string $subject): void {
    File::put(environmentFile(), "APP_NAME=Acme\n");

    $this->artisan('inertia-notifications:vapid', ['--subject' => $subject])
        ->expectsOutputToContain('must be a mailto: address or an https:// URL')
        ->assertFailed();

    expect(File::get(environmentFile()))->toBe("APP_NAME=Acme\n");
})->with(['http://acme.test', 'mailto:not-an-address', 'support']);

it('writes a subject of the option on a placeholder domain, with the warning of check-push', function (): void {
    File::put(environmentFile(), "APP_NAME=Acme\n");

    $this->artisan('inertia-notifications:vapid', ['--subject' => 'ops@example.com'])
        ->expectsOutputToContain('Apple refuses the pushes of a subject on localhost or example.com')
        ->assertSuccessful();

    expect(environmentVariables()['VAPID_SUBJECT'])->toBe('mailto:ops@example.com');
});

it('asks for the subject when none is set', function (): void {
    File::put(environmentFile(), "APP_NAME=Acme\n");
    config(['inertia-notifications.push.subject' => null]);

    $this->artisan('inertia-notifications:vapid')
        ->expectsQuestion('Which email address may push services contact you at?', 'ops@acme.test')
        ->assertSuccessful();

    expect(environmentVariables()['VAPID_SUBJECT'])->toBe('mailto:ops@acme.test');
});

it('refuses an answer on a placeholder domain, as the hint of the question says', function (): void {
    File::put(environmentFile(), "APP_NAME=Acme\n");
    config(['inertia-notifications.push.subject' => null]);

    $this->artisan('inertia-notifications:vapid')
        ->expectsQuestion('Which email address may push services contact you at?', 'ops@example.com')
        ->expectsOutputToContain('Apple refuses example.com and localhost.')
        ->assertFailed();

    expect(File::get(environmentFile()))->toBe("APP_NAME=Acme\n");
});

it('fails without interaction when there is no subject to use', function (array $config): void {
    File::put(environmentFile(), "APP_NAME=Acme\n");
    config($config);

    $this->artisan('inertia-notifications:vapid', ['--no-interaction' => true])
        ->expectsOutputToContain('--subject=mailto:you@your-app.com')
        ->assertFailed();

    expect(File::get(environmentFile()))->toBe("APP_NAME=Acme\n");
})->with([
    'no subject that is set' => [['inertia-notifications.push.subject' => null]],
    'a subject on example.com that is set' => [['inertia-notifications.push.subject' => 'mailto:hello@example.com']],
]);

it('writes a subject without a warning exactly when check-push reports it OK', function (string $subject, bool $accepted): void {
    File::put(environmentFile(), "APP_NAME=Acme\n");

    $status = Artisan::call('inertia-notifications:vapid', ['--subject' => $subject]);
    $written = $status === 0 && ! str_contains(Artisan::output(), 'WARN');

    config(['inertia-notifications.push.subject' => $subject]);

    Artisan::call('inertia-notifications:check-push');

    $passed = preg_match('/VAPID subject \.+ .* OK/', Artisan::output()) === 1;

    expect($written)
        ->toBe($accepted)
        ->and($passed)
        ->toBe($accepted);
})->with([
    'an address on a domain of the application' => ['mailto:support@acme.test', true],
    'a URL on a domain of the application' => ['https://acme.test/contact', true],
    'an address without a domain' => ['mailto:support', false],
    'a URL without a host' => ['https://', false],
    'an address on localhost' => ['mailto:support@localhost', false],
    'an address on example.com' => ['mailto:hello@example.com', false],
    'an address on a subdomain of example.org' => ['mailto:push@mail.example.org', false],
    'a URL on localhost' => ['https://localhost', false],
    'an http:// URL' => ['http://acme.test', false],
]);

it('asks for confirmation in production', function (): void {
    File::put(environmentFile(), "APP_NAME=Acme\n");
    $this->app->detectEnvironment(fn (): string => 'production');

    // Laravel only lets prompts fall back to the questions that the test answers while the application runs
    // unit tests, or once a command ran during the test, such as the migrations of an empty database.
    Prompt::fallbackWhen(true);

    $this->artisan('inertia-notifications:vapid')
        ->expectsConfirmation('Are you sure you want to run this command?', 'no')
        ->assertFailed();

    expect(File::get(environmentFile()))->toBe("APP_NAME=Acme\n");
});

it('prints the steps that remain', function (): void {
    File::put(environmentFile(), "APP_NAME=Acme\n");

    $this->artisan('inertia-notifications:vapid')
        ->expectsOutputToContain("'enabled' => true")
        ->expectsOutputToContain('Call ->push() on the toInbox() message of your notifications.')
        ->expectsOutputToContain('php artisan inertia-notifications:check-push')
        ->doesntExpectOutputToContain('php artisan migrate')
        ->assertSuccessful();
});

it('reminds to cache the configuration again when it is cached', function (): void {
    File::put(environmentFile(), "APP_NAME=Acme\n");

    $this->app->instance('config_loaded_from_cache', true);

    $this->artisan('inertia-notifications:vapid')
        ->expectsOutputToContain('Run [php artisan config:cache] to load the keys.')
        ->assertSuccessful();
});
