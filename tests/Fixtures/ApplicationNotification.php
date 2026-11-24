<?php

namespace InertiaUI\Notifications\Tests\Fixtures;

use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;

abstract class ApplicationNotification extends Notification
{
    /**
     * Get the broadcastable representation of the notification.
     */
    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage(['invoice' => 'INV-7']);
    }

    /**
     * Get the type of the notification being broadcast.
     */
    public function broadcastType(): string
    {
        return 'invoice.paid';
    }

    /**
     * Get the delay of the queued job that sends the notification through the given channel.
     */
    public function withDelay(object $notifiable, string $channel): mixed
    {
        return ['sms' => 60];
    }
}
