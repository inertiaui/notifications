<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use InertiaUI\Notifications\Push;
use Pest\Browser\Api\AwaitableWebpage;
use Pest\Browser\Api\PendingAwaitablePage;
use Pest\Browser\Browsable;
use Tests\TestCase;

// The demo pushes its notifications too, so every test fakes the sender of the pushes, which records them instead
// of sending them to a push service. Browsers still subscribe and unsubscribe as they do without the fake.
pest()->extends(TestCase::class)
    ->use(Browsable::class, RefreshDatabase::class)
    ->beforeEach(function () {
        Push::fake();
    })
    ->in('Browser');

// A stand-in for Laravel Echo that records the listener of each event on each channel, so a test can send broadcasts
// with broadcastEvent() and broadcastNotification(). A test installs it with script() after the visit, which the next
// visit then uses, or with addInitScript() before the application starts.
const FAKE_ECHO = <<<'JS'
    window.Echo = {
        channels: {},
        private(channel) {
            const listeners = (this.channels[channel] ??= {})

            return {
                listen: (event, callback) => void (listeners[event] = callback),
                stopListening: (event) => void delete listeners[event],
            }
        },
        socketId: () => '1234.5678',
        listens(channel, event) {
            return typeof this.channels[channel]?.[event] === 'function'
        },
        // Sends the payload to the listener of the event on the channel, and resolves once the page has rendered it,
        // since the assertions do not wait.
        emit(channel, event, payload) {
            if (!this.listens(channel, event)) {
                const listening = Object.entries(this.channels)
                    .flatMap(([name, listeners]) => Object.keys(listeners).map((key) => `${key} on ${name}`))
                    .join(', ')

                throw new Error(`Echo has no listener for ${event} on ${channel}, only for: ${listening || 'nothing'}`)
            }

            this.channels[channel][event](payload)

            return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))
        },
    }
    JS;

// The event that Echo listens for to receive the notifications that the notification center stores.
const ARRIVED_EVENT = '.inertiaui.inbox.arrived';

/**
 * The script that tells whether the page listens for the event on the channel with the stand-in Echo.
 */
function listensFor(string $channel, string $event): string
{
    return 'window.Echo.listens('.json_encode($channel).', '.json_encode($event).')';
}

/**
 * Send the payload to the page as Echo receives the event on the channel, which fails when the page does not listen.
 *
 * @param  array<string, mixed>  $payload
 */
function broadcastEvent(AwaitableWebpage|PendingAwaitablePage $page, string $channel, string $event, array $payload): void
{
    $page->script('window.Echo.emit('.json_encode($channel).', '.json_encode($event).', '.json_encode($payload).')');
}

/**
 * Send the notification to the page as the InboxNotificationArrived event sends it.
 *
 * @param  array<string, mixed>|JsonSerializable  $item  The notification as the inbox lists it.
 * @param  array<string, mixed>|null  $counts  The counts that a notification that collapsed sends after it.
 */
function broadcastNotification(AwaitableWebpage|PendingAwaitablePage $page, string $channel, array|JsonSerializable $item, ?array $counts = null): void
{
    $payload = ['item' => $item];

    broadcastEvent($page, $channel, ARRIVED_EVENT, $counts === null ? $payload : [...$payload, 'counts' => $counts]);
}
