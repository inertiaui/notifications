<?php

use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use InertiaUI\Notifications\Events\NotificationPreferencesChanged;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\InboxMessage;
use InertiaUI\Notifications\Models\NotificationPreference;
use InertiaUI\Notifications\NotificationHoursChange;
use InertiaUI\Notifications\NotificationPreferences;
use InertiaUI\Notifications\Tests\Fixtures\InvoicePaid;
use InertiaUI\Notifications\Tests\Fixtures\User;

beforeEach(function (): void {
    config()->set('inertia-notifications.preferences.categories', [
        'billing' => ['label' => 'Billing', 'description' => 'Invoices and payments.'],
        'comments' => ['label' => 'Comments', 'channels' => ['inbox']],
        'security' => ['label' => 'Security', 'locked' => true],
        'product' => ['label' => 'Product updates', 'opt_in' => true],
    ]);

    registerNotificationRoutes();

    $this->user = User::named('Pascal');
});

/**
 * Create a notification in the given category.
 *
 * Its inbox message has a different category.
 */
function categorized(?string $category, string $inboxCategory = 'billing'): Notification
{
    return new class($category, $inboxCategory) extends Notification
    {
        /**
         * Create a new notification instance.
         *
         * @param  string|null  $category  The category that notificationCategory() returns.
         * @param  string  $inboxCategory  The category of the inbox message.
         */
        public function __construct(public ?string $category, public string $inboxCategory) {}

        /**
         * Get the notification's delivery channels.
         *
         * @return list<string>
         */
        public function via(object $notifiable): array
        {
            return ['inbox'];
        }

        /**
         * Get the category of the notification.
         */
        public function notificationCategory(object $notifiable): ?string
        {
            return $this->category;
        }

        /**
         * Get the inbox representation of the notification.
         */
        public function toInbox(object $notifiable): InboxMessage
        {
            return InboxMessage::make('Categorized')->category($this->inboxCategory);
        }
    };
}

it('lists the categories and channels with the choices of the signed-in user', function (): void {
    NotificationPreferences::update($this->user, ['billing' => ['mail' => false]]);
    NotificationPreferences::update(User::named('Sophie'), ['comments' => ['inbox' => false]]);

    $this->actingAs($this->user)
        ->getJson('/_inertia-notifications/preferences')
        ->assertOk()
        ->assertExactJson([
            'channels' => [
                [
                    'key' => 'inbox',
                    'label' => 'In the app',
                    'globalSwitch' => true,
                    'enabled' => true,
                    'digest' => false,
                    'inbox' => true,
                    'push' => false,
                ],
                [
                    'key' => 'mail',
                    'label' => 'Email',
                    'globalSwitch' => true,
                    'enabled' => true,
                    'digest' => true,
                    'inbox' => false,
                    'push' => false,
                ],
            ],
            'groups' => [],
            'categories' => [
                [
                    'key' => 'billing',
                    'label' => 'Billing',
                    'description' => 'Invoices and payments.',
                    'group' => null,
                    'locked' => false,
                    'channels' => ['inbox' => true, 'mail' => false],
                    'frequency' => null,
                ],
                [
                    'key' => 'comments',
                    'label' => 'Comments',
                    'description' => null,
                    'group' => null,
                    'locked' => false,
                    'channels' => ['inbox' => true],
                    'frequency' => null,
                ],
                [
                    'key' => 'security',
                    'label' => 'Security',
                    'description' => null,
                    'group' => null,
                    'locked' => true,
                    'channels' => ['inbox' => true, 'mail' => true],
                    'frequency' => null,
                ],
                [
                    'key' => 'product',
                    'label' => 'Product updates',
                    'description' => null,
                    'group' => null,
                    'locked' => false,
                    'channels' => ['inbox' => false, 'mail' => false],
                    'frequency' => null,
                ],
            ],
            'frequencies' => ['instant', 'hourly', 'daily', 'weekly'],
            'notificationHours' => null,
        ]);
});

it('lists the groups that have categories, in the order of the config', function (): void {
    config()->set('inertia-notifications.preferences.groups', [
        'news' => ['label' => 'News'],
        'account' => ['label' => 'Account', 'description' => 'Your payments and sign-ins.'],
    ]);
    config()->set('inertia-notifications.preferences.categories.comments.group', 'activity');
    config()->set('inertia-notifications.preferences.categories.security.group', 'account');
    config()->set('inertia-notifications.preferences.categories.billing.group', 'account');

    $this->actingAs($this->user)
        ->getJson('/_inertia-notifications/preferences')
        ->assertOk()
        ->assertJsonPath('groups', [
            ['key' => 'account', 'label' => 'Account', 'description' => 'Your payments and sign-ins.'],
            ['key' => 'activity', 'label' => 'activity', 'description' => null],
        ])
        ->assertJsonPath('categories.*.group', ['account', 'activity', 'account', null]);
});

it('answers with the preferences that the frontend tests read', function (): void {
    config([
        'inertia-notifications.preferences.channels.devices' => ['label' => 'On your devices', 'via' => ['push']],
        'inertia-notifications.preferences.groups' => [
            'account' => ['label' => 'Account', 'description' => 'Your payments and sign-ins.'],
        ],
        'inertia-notifications.preferences.categories' => [
            'billing' => [
                'label' => 'Billing',
                'description' => 'Invoices and payments.',
                'group' => 'account',
                'digest' => true,
            ],
            'comments' => ['label' => 'Comments', 'channels' => ['inbox']],
            'security' => ['label' => 'Security', 'locked' => true, 'group' => 'account'],
        ],
        'inertia-notifications.digests.frequencies' => ['daily', 'weekly'],
        'inertia-notifications.notification_hours.enabled' => true,
    ]);

    NotificationPreferences::update(
        $this->user,
        ['billing' => ['devices' => false]],
        channels: ['mail' => false],
        frequencies: ['billing' => 'daily'],
        notificationHours: new NotificationHoursChange(enabled: true, days: [
            'monday' => ['09:00-12:00', '13:00-17:00'],
            'saturday' => [],
            'sunday' => [],
        ]),
    );

    $preferences = $this->actingAs($this->user)
        ->getJson(route('inertia-notifications.preferences'))
        ->getContent();
    $fixture = jsonFixture('preferences.json');

    // Decoded as objects, so an empty JSON object and an empty array stay apart.
    expect(json_decode((string) $preferences))->toEqual($fixture);
});

it('saves the choices of the signed-in user', function (): void {
    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/preferences', ['preferences' => [
            'billing' => ['mail' => false],
            'comments' => ['inbox' => false],
        ]])
        ->assertOk()
        ->assertJsonPath('categories.0.channels', ['inbox' => true, 'mail' => false])
        ->assertJsonPath('categories.1.channels', ['inbox' => false]);

    $this->postJson('/_inertia-notifications/preferences', ['preferences' => ['billing' => ['mail' => true]]])
        ->assertOk()
        ->assertJsonPath('categories.0.channels', ['inbox' => true, 'mail' => true])
        ->assertJsonPath('categories.1.channels', ['inbox' => false]);

    $saved = NotificationPreference::query()
        ->orderBy('category')
        ->get(['category', 'channel', 'enabled'])
        ->toArray();

    expect($saved)->toBe([
        ['category' => 'billing', 'channel' => 'mail', 'enabled' => true],
        ['category' => 'comments', 'channel' => 'inbox', 'enabled' => false],
    ]);
});

it('leaves locked categories and unknown categories and channels unchanged', function (): void {
    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/preferences', ['preferences' => [
            'comments' => ['mail' => false],
            'security' => ['inbox' => false],
            'marketing' => ['mail' => false],
        ]])
        ->assertOk()
        ->assertJsonPath('categories.1.channels', ['inbox' => true])
        ->assertJsonPath('categories.2.channels', ['inbox' => true, 'mail' => true]);

    expect(NotificationPreference::query()->count())->toBe(0);
});

it('turns a channel off and on for every category', function (): void {
    NotificationPreferences::update($this->user, ['billing' => ['mail' => false]]);

    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/preferences', ['channels' => ['mail' => false]])
        ->assertOk()
        ->assertJsonPath('channels.1', [
            'key' => 'mail',
            'label' => 'Email',
            'globalSwitch' => true,
            'enabled' => false,
            'digest' => true,
            'inbox' => false,
            'push' => false,
        ])
        ->assertJsonPath('channels.0.enabled', true)
        ->assertJsonPath('categories.0.channels', ['inbox' => true, 'mail' => false]);

    expect(NotificationPreferences::channelEnabled($this->user, 'mail'))->toBeFalse();

    $this->postJson('/_inertia-notifications/preferences', ['channels' => ['mail' => true]])
        ->assertOk()
        ->assertJsonPath('channels.1.enabled', true)
        ->assertJsonPath('categories.0.channels', ['inbox' => true, 'mail' => false]);
});

it('skips a channel that the user turned off for every category, except for locked categories', function (): void {
    NotificationPreferences::update($this->user, ['product' => ['inbox' => true]], ['inbox' => false]);

    $this->user->notify(new InvoicePaid);
    $this->user->notify(categorized('product'));
    $this->user->notify(categorized('security'));
    $this->user->notify(categorized('marketing'));

    expect(Inbox::query($this->user)->count())
        ->toBe(2)
        ->and(NotificationPreferences::enabled($this->user, 'billing', 'inbox'))
        ->toBeFalse()
        ->and(NotificationPreferences::enabled($this->user, 'product', 'inbox'))
        ->toBeFalse()
        ->and(NotificationPreferences::enabled($this->user, 'billing', 'mail'))
        ->toBeTrue();

    NotificationPreferences::update($this->user, channels: ['inbox' => true]);

    expect(NotificationPreferences::enabled($this->user, 'product', 'inbox'))->toBeTrue();
});

it('keeps a channel without a switch for every category on', function (): void {
    config()->set('inertia-notifications.preferences.channels.mail.global_switch', false);

    // Saving preferences leaves such a channel unchanged, so we will store a
    // switch for it directly to make sure that sending ignores the switch.
    NotificationPreference::query()->create([
        'notifiable_type' => $this->user->getMorphClass(),
        'notifiable_id' => $this->user->getKey(),
        'category' => '*',
        'channel' => 'mail',
        'enabled' => false,
    ]);

    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/preferences', ['channels' => ['mail' => true, 'slack' => false]])
        ->assertOk()
        ->assertJsonPath('channels.1', [
            'key' => 'mail',
            'label' => 'Email',
            'globalSwitch' => false,
            'enabled' => true,
            'digest' => true,
            'inbox' => false,
            'push' => false,
        ]);

    expect(NotificationPreferences::enabled($this->user, 'billing', 'mail'))
        ->toBeTrue()
        ->and(NotificationPreference::query()->sole()->enabled)
        ->toBeFalse();
});

it('dispatches an event with the choices that changed', function (): void {
    Event::fake(NotificationPreferencesChanged::class);

    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/preferences', [
            'preferences' => [
                'billing' => ['inbox' => true, 'mail' => false],
                'product' => ['mail' => true],
                'security' => ['mail' => false],
            ],
            'channels' => ['inbox' => true, 'mail' => false],
        ])
        ->assertOk();

    Event::assertDispatchedTimes(NotificationPreferencesChanged::class, 1);
    Event::assertDispatched(function (NotificationPreferencesChanged $event): bool {
        return $event->notifiable->is($this->user)
            && $event->categories === ['billing' => ['mail' => false], 'product' => ['mail' => true]]
            && $event->channels === ['mail' => false];
    });
});

it('dispatches no event when no choice changed', function (): void {
    NotificationPreferences::update($this->user, ['billing' => ['mail' => false]], ['mail' => false]);

    Event::fake(NotificationPreferencesChanged::class);

    NotificationPreferences::update($this->user, ['billing' => ['mail' => false], 'comments' => ['inbox' => true]]);
    NotificationPreferences::update($this->user, ['security' => ['mail' => false]], ['mail' => false]);
    NotificationPreferences::update($this->user, ['product' => ['mail' => false]]);

    Event::assertNotDispatched(NotificationPreferencesChanged::class);

    NotificationPreferences::update($this->user, ['billing' => ['mail' => true]]);

    Event::assertDispatched(
        NotificationPreferencesChanged::class,
        fn (NotificationPreferencesChanged $event): bool => $event->categories === ['billing' => ['mail' => true]]
            && $event->channels === [],
    );
});

it('dispatches the event once the transaction commits', function (): void {
    $dispatched = false;

    Event::listen(NotificationPreferencesChanged::class, function () use (&$dispatched): void {
        $dispatched = true;
    });

    DB::transaction(function () use (&$dispatched): void {
        NotificationPreferences::update($this->user, ['billing' => ['mail' => false]]);

        expect($dispatched)->toBeFalse();
    });

    expect($dispatched)->toBeTrue();
});

it('rejects choices that are not true or false', function (): void {
    $this->actingAs($this->user)
        ->postJson('/_inertia-notifications/preferences', ['preferences' => ['billing' => ['mail' => 'maybe']]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('preferences.billing.mail');

    $this->postJson('/_inertia-notifications/preferences', ['channels' => ['mail' => 'maybe']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('channels.mail');

    $this->postJson('/_inertia-notifications/preferences', [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['preferences', 'channels', 'frequencies', 'notificationHours']);

    expect(NotificationPreference::query()->count())->toBe(0);
});

it('skips a channel that the user turned off for the category of the notification', function (): void {
    $sophie = User::named('Sophie');
    NotificationPreferences::update($this->user, ['billing' => ['inbox' => false]]);

    $this->user->notify(new InvoicePaid);
    $sophie->notify(new InvoicePaid);

    expect(Inbox::query($this->user)->count())
        ->toBe(0)
        ->and(Inbox::query($sophie)->count())
        ->toBe(1);

    NotificationPreferences::update($this->user, ['billing' => ['inbox' => true]]);

    $this->user->notify(new InvoicePaid);

    expect(Inbox::query($this->user)->count())->toBe(1);
});

it('reads the category from notificationCategory() before the inbox message', function (): void {
    NotificationPreferences::update($this->user, ['comments' => ['inbox' => false]]);

    $this->user->notify(categorized('comments'));
    $this->user->notify(categorized(null, 'comments'));

    expect(Inbox::query($this->user)->count())->toBe(1);
});

it('refuses every channel that a choice the user turned off covers', function (string $channel): void {
    NotificationPreferences::update($this->user, ['billing' => ['inbox' => false, 'mail' => false]]);

    expect(NotificationPreferences::allows($this->user, new InvoicePaid, $channel))->toBeFalse();
})->with([
    'the channel of the choice' => 'mail',
    'a channel that the inbox choice covers' => 'database',
]);

it('keeps an opt-in category off until the user turns it on', function (): void {
    $this->user->notify(categorized('product'));

    expect(Inbox::query($this->user)->count())->toBe(0);

    NotificationPreferences::update($this->user, ['product' => ['inbox' => true]]);

    $this->user->notify(categorized('product'));

    expect(Inbox::query($this->user)->count())
        ->toBe(1)
        ->and(NotificationPreferences::enabled($this->user, 'product', 'mail'))
        ->toBeFalse();
});

it('always sends locked categories', function (): void {
    // Saving preferences leaves a locked category unchanged, so we will store a
    // choice for it directly to make sure that sending ignores the choice.
    NotificationPreference::query()->create([
        'notifiable_type' => $this->user->getMorphClass(),
        'notifiable_id' => $this->user->getKey(),
        'category' => 'security',
        'channel' => 'inbox',
        'enabled' => false,
    ]);

    expect(NotificationPreferences::allows($this->user, categorized('security'), 'inbox'))->toBeTrue();
});

it('always sends a locked category that is also opt-in', function (): void {
    config()->set('inertia-notifications.preferences.categories.security.opt_in', true);

    expect(NotificationPreferences::allows($this->user, categorized('security'), 'inbox'))->toBeTrue();
});

it('tells the same whether a user receives a category as the categories that the user does not receive', function (
    array $categories,
    array $channels,
    array $rows = [],
    bool $mailSwitch = true,
): void {
    config()->set('inertia-notifications.preferences.channels.mail.global_switch', $mailSwitch);

    NotificationPreferences::update($this->user, $categories, $channels);

    // Saving preferences never stores these rows, so we will store them directly.
    foreach ($rows as $row) {
        NotificationPreference::query()->create([
            'notifiable_type' => $this->user->getMorphClass(),
            'notifiable_id' => $this->user->getKey(),
            ...$row,
        ]);
    }

    foreach (['inbox', 'mail'] as $channel) {
        $disabled = NotificationPreferences::disabledCategories($this->user, $channel);

        foreach (['billing', 'comments', 'security', 'product', 'marketing'] as $category) {
            expect(NotificationPreferences::enabled($this->user, $category, $channel))
                ->toBe(! in_array($category, $disabled, true), "The {$category} category on the {$channel} channel.");
        }
    }
})->with([
    'without choices' => [[], []],
    'with a category turned off' => [['billing' => ['mail' => false]], []],
    'with an opt-in category turned on' => [['product' => ['mail' => true]], []],
    'with a channel turned off' => [['product' => ['inbox' => true]], ['inbox' => false]],
    'with a channel turned off and on again' => [['billing' => ['inbox' => false]], ['inbox' => true]],
    'with a switch of a channel without a switch for every category' => [
        ['product' => ['mail' => true]],
        [],
        [['category' => '*', 'channel' => 'mail', 'enabled' => false]],
        false,
    ],
    'with a choice of a locked category' => [[], [], [['category' => 'security', 'channel' => 'inbox', 'enabled' => false]]],
    'with a choice and a switch without a value' => [[], [], [
        ['category' => 'billing', 'channel' => 'mail', 'enabled' => null],
        ['category' => '*', 'channel' => 'inbox', 'enabled' => null],
    ]],
]);

it('reads the preferences of a user with one query', function (): void {
    config()->set('inertia-notifications.notification_hours.enabled', true);
    NotificationPreferences::update($this->user, ['billing' => ['mail' => false]], ['inbox' => false], timezone: 'Europe/Amsterdam');

    DB::enableQueryLog();

    NotificationPreferences::for($this->user);

    expect(DB::getQueryLog())->toHaveCount(1);

    DB::flushQueryLog();

    NotificationPreferences::enabled($this->user, 'billing', 'inbox');

    expect(DB::getQueryLog())->toHaveCount(1);
});

it('always sends the categories and channels that the config does not list', function (
    Notification $notification,
    string $channel,
): void {
    NotificationPreferences::update($this->user, ['billing' => ['inbox' => false, 'mail' => false]]);

    expect(NotificationPreferences::allows($this->user, $notification, $channel))->toBeTrue();
})->with([
    'a channel' => [fn () => new InvoicePaid, 'slack'],
    'a category' => [fn () => categorized('marketing'), 'inbox'],
    'a channel of the category' => [fn () => categorized('comments'), 'mail'],
]);
