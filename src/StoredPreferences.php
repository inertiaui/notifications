<?php

namespace InertiaUI\Notifications;

/**
 * The preferences that a notifiable model stored, read from one query of its rows. A choice, a switch,
 * or a frequency that the notifiable model never stored reads as its default.
 *
 * @internal
 */
class StoredPreferences
{
    /**
     * Create a new stored preferences instance.
     *
     * @param  array<string, array<string, bool>>  $categories  The choices by category and channel.
     * @param  array<string, bool>  $channels  The switches of channels for every category.
     * @param  array<string, string>  $frequencies  The digest frequencies by category.
     * @param  array<string, mixed>  $settings  The settings of the notifiable model, such as its timezone.
     */
    public function __construct(
        public readonly array $categories,
        public readonly array $channels,
        public readonly array $frequencies,
        public readonly array $settings,
    ) {}

    /**
     * Determine if the given channel is on for every category, which it is by default.
     */
    public function channelEnabled(string $channel): bool
    {
        return $this->channels[$channel] ?? true;
    }

    /**
     * Get the frequency of the given category, which is `instant` by default.
     */
    public function frequency(string $category): string
    {
        return $this->frequencies[$category] ?? 'instant';
    }

    /**
     * Get the choice of a category on a channel, which is on by default unless the category is opt-in.
     */
    public function choice(string $category, string $channel, bool $optIn): bool
    {
        return $this->categories[$category][$channel] ?? ! $optIn;
    }
}
