<?php

namespace InertiaUI\Notifications\Notifications;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\Models\DigestItem;
use InertiaUI\Notifications\NotificationPreferences;
use InertiaUI\Notifications\Toast;

/**
 * The digest of the notifications that were held for a notifiable model, sent through the channels that held them.
 *
 * Extend it to change the mail, or to send the digest through a channel without a `toMail()` method,
 * and set your class as the `digests.notification` config.
 *
 * @phpstan-import-type HeldNotification from DigestItem
 *
 * @phpstan-consistent-constructor
 */
class NotificationDigest extends Notification
{
    /**
     * Create a new notification instance.
     *
     * @param  list<HeldNotification>  $items
     */
    public function __construct(public array $items) {}

    /**
     * Get the notification's delivery channels.
     *
     * The digest is sent through each channel that held a notification.
     *
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return collect($this->items)->pluck('channel')->unique()->values()->all();
    }

    /**
     * Get the mail representation of the notification.
     *
     * The mail leads with the number of notifications in each category, and then shows the notifications
     * of each category, newest first, with the times in the notifiable model's timezone.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $messages = $this->messages('mail');

        return $this->buildMailMessage(
            count($messages),
            $this->sections($messages, Carbon::now($this->timezone($notifiable))),
            $this->inboxUrl($notifiable),
            $this->preferencesUrl($notifiable),
        );
    }

    /**
     * Get the digest mail message for the given number of notifications, sections, and links.
     *
     * Override this method to change the subject or the views of the mail while you keep the sections and
     * the links that `toMail()` prepares. Each section is a category, in the order of the preferences, with
     * its notifications as the mail shows them. A null link leaves out its button or footer link.
     *
     * @param  list<array{label: string, messages: list<array<string, mixed>>}>  $sections
     */
    protected function buildMailMessage(
        int $count,
        array $sections,
        ?string $inboxUrl,
        ?string $preferencesUrl,
    ): MailMessage {
        return (new MailMessage)
            ->subject(trans_choice('You have :count new notification|You have :count new notifications', $count))
            ->view([
                'html' => 'inertia-notifications::mail.digest',
                'text' => 'inertia-notifications::mail.digest-text',
            ], [
                'heading' => trans_choice(':count new notification|:count new notifications', $count),
                'lead' => count($sections) > 1 ? $this->lead($sections) : null,
                'sections' => $sections,
                'inboxUrl' => $inboxUrl,
                'preferencesUrl' => $preferencesUrl,
            ]);
    }

    /**
     * Get the notifications that the given channel sends, or every channel, oldest first, as the frontend
     * receives them.
     *
     * Each notification is translated in the current locale, which is the notifiable model's preferred
     * locale while the digest is sent.
     *
     * @return list<array<string, mixed>>
     */
    public function messages(?string $channel = null): array
    {
        $model = Inbox::model();
        $messages = [];

        foreach ($this->items as $item) {
            if ($channel !== null && $item['channel'] !== $channel) {
                continue;
            }

            $messages[] = (new $model)->forceFill([
                'id' => $item['id'],
                'type' => $item['type'],
                'category' => $item['category'],
                'data' => $item['data'],
                'collapsed' => $item['collapsed'] ?? null,
                'created_at' => Carbon::parse($item['created_at']),
            ])->toInboxArray();
        }

        return $messages;
    }

    /**
     * Get the sections of the mail, one for each category in the order of the preferences, with the newest
     * notification first.
     *
     * @param  list<array<string, mixed>>  $messages
     * @return list<array{label: string, messages: list<array<string, mixed>>}>
     */
    protected function sections(array $messages, CarbonInterface $now): array
    {
        $order = array_flip(array_keys(NotificationPreferences::categories()));

        return collect($messages)
            ->reverse()
            ->map(fn (array $message): array => $this->messageForMail($message, $now))
            ->groupBy('category')
            ->sortBy(fn ($group, string $category): int => $order[$category] ?? count($order))
            ->map(fn ($group, string $category): array => [
                'label' => $this->categoryLabel($category),
                'messages' => $group->values()->all(),
            ])
            ->values()
            ->all();
    }

    /**
     * Get the given notification as the mail shows it.
     *
     * The URLs are absolute, and the notification also has the `avatar` and `initials` of its actor and the
     * `time` that it was sent.
     *
     * @param  array<string, mixed>  $message
     * @return array<string, mixed>
     */
    protected function messageForMail(array $message, CarbonInterface $now): array
    {
        $actor = is_array($message['actor']) ? $message['actor'] : [];

        return [
            ...$message,
            'url' => $this->absoluteUrl($message['url']),
            'image' => $this->absoluteUrl($message['image']),
            'avatar' => $this->absoluteUrl($actor['avatar'] ?? null),
            'initials' => $this->initials($actor['name'] ?? null),
            'time' => $this->time(Carbon::parse($message['createdAt'])->setTimezone($now->getTimezone()), $now),
        ];
    }

    /**
     * Get the lead of the mail, which counts the notifications in each category.
     *
     * @param  list<array{label: string, messages: list<array<string, mixed>>}>  $sections
     */
    protected function lead(array $sections): string
    {
        $counts = collect($sections)->map(fn (array $section): string => __(':count in :category', [
            'count' => count($section['messages']),
            'category' => $section['label'],
        ]));

        return $counts->join(', ', ' '.__('and').' ').'.';
    }

    /**
     * Get the time that a notification was sent, as the mail shows it.
     *
     * The mail shows the time of the notifications of today, the day and time of the notifications of the
     * past week, and the date of older notifications.
     */
    protected function time(CarbonInterface $time, CarbonInterface $now): string
    {
        $time = $time->locale(app()->getLocale());

        if ($time->isSameDay($now)) {
            return $time->isoFormat('LT');
        }

        if ($time->greaterThanOrEqualTo($now->copy()->subDays(6)->startOfDay())) {
            return $time->isoFormat('ddd LT');
        }

        return $time->isoFormat('ll');
    }

    /**
     * Get the initials of the given actor's name, as the notification center shows them without an avatar.
     */
    protected function initials(mixed $name): ?string
    {
        if (! is_string($name) || trim($name) === '') {
            return null;
        }

        return collect(preg_split('/\s+/u', trim($name)))
            ->take(2)
            ->map(fn (string $word): string => Str::upper(Str::substr($word, 0, 1)))
            ->join('');
    }

    /**
     * Get the label of the given category, translated in the current locale.
     */
    protected function categoryLabel(string $category): string
    {
        return Toast::translate(NotificationPreferences::categories()[$category]['label'] ?? $category);
    }

    /**
     * Get the URL of the page with every notification, which the button below the notifications opens.
     */
    protected function inboxUrl(object $notifiable): ?string
    {
        return $this->absoluteUrl(config('inertia-notifications.digests.inbox_url'));
    }

    /**
     * Get the URL of the page where the notifiable model changes its preferences, which the footer links to.
     */
    protected function preferencesUrl(object $notifiable): ?string
    {
        return $this->absoluteUrl(config('inertia-notifications.digests.preferences_url'));
    }

    /**
     * Get the given path or URL as an absolute URL.
     */
    protected function absoluteUrl(mixed $url): ?string
    {
        return is_string($url) && $url !== '' ? url($url) : null;
    }

    /**
     * Get the timezone of the notifiable model, in which the mail shows the times of the notifications.
     */
    protected function timezone(object $notifiable): string
    {
        if (! $notifiable instanceof Model) {
            return date_default_timezone_get();
        }

        return NotificationPreferences::timezone($notifiable);
    }
}
