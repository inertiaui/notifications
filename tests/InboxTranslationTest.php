<?php

use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\InboxMessage;
use InertiaUI\Notifications\Tests\Fixtures\User;
use InertiaUI\Notifications\ToastAction;

beforeEach(function (): void {
    registerNotificationRoutes();

    app('translator')->addLines([
        'invoices.paid' => 'Invoice :number paid',
        'invoices.due' => 'Due on :date.',
        'invoices.refund' => 'Refund :amount',
        'invoices.refund_help' => 'Refund the payment of :amount',
    ], 'en');

    app('translator')->addLines([
        'invoices.paid' => 'Factuur :number betaald',
        'invoices.due' => 'Te betalen op :date.',
        'invoices.refund' => ':amount terugbetalen',
        'invoices.refund_help' => 'De betaling van :amount terugbetalen',
    ], 'nl');

    $this->user = User::named('Pascal');
});

it('translates the title, body, and actions in the locale of the user who reads them', function (): void {
    $message = InboxMessage::make('invoices.paid', ['number' => 'INV-7'])
        ->body('invoices.due', ['date' => Carbon::parse('2026-11-20')])
        ->action(
            ToastAction::make('invoices.refund', ['amount' => '$120'])
                ->post('/invoices/7/refund')
                ->altText('invoices.refund_help', ['amount' => '$120']),
        );

    // The notification is sent in the locale of the user who receives it, who then switches to English.
    app()->setLocale('nl');
    Inbox::record($this->user, (string) Str::uuid(), 'test', $message);
    app()->setLocale('en');

    $item = $this->actingAs($this->user)
        ->getJson('/_inertia-notifications')
        ->json('items.0');

    expect($item['title'])
        ->toBe('Invoice INV-7 paid')
        ->and($item['body'])
        ->toBe('Due on 2026-11-20 00:00:00.')
        // MySQL's JSON type sorts the keys of the stored actions.
        ->and($item['actions'])
        ->toEqual([[
            'label' => 'Refund $120',
            'href' => '/invoices/7/refund',
            'method' => 'post',
            'altText' => 'Refund the payment of $120',
        ]])
        ->and($item)
        ->not->toHaveKey('translate');
});

it('stores the translation keys and their replacements', function (): void {
    app()->setLocale('nl');

    $stored = Inbox::record($this->user, (string) Str::uuid(), 'test', InboxMessage::make('invoices.paid', [
        'number' => 'INV-7',
    ]));

    expect($stored->fresh()->data)->toMatchArray([
        'title' => 'invoices.paid',
        'translate' => ['title' => ['number' => 'INV-7'], 'body' => []],
    ]);
});

it('shows text without a translation key as it was stored', function (): void {
    Inbox::record($this->user, (string) Str::uuid(), 'test', InboxMessage::make('Invoice :number paid', [
        'number' => 'INV-7',
    ])->body('Paid by card.'));

    $items = $this->actingAs($this->user)
        ->getJson('/_inertia-notifications')
        ->json('items');

    expect(array_column($items, 'title'))
        ->toBe(['Invoice INV-7 paid'])
        ->and(array_column($items, 'body'))
        ->toBe(['Paid by card.']);
});
