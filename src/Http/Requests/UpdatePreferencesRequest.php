<?php

namespace InertiaUI\Notifications\Http\Requests;

use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;
use InertiaUI\Notifications\NotificationHours;
use InertiaUI\Notifications\NotificationHoursChange;
use InertiaUI\Notifications\NotificationPreferences;

/**
 * The request that updates the notification preferences of the signed-in user.
 *
 * The request sends some or all choices, as `preferences[category][channel] = true|false`, the switches of
 * channels for every category, as `channels[channel] = true|false`, the digest frequencies that the application
 * offers, as `frequencies[category] = instant|hourly|daily|weekly`, and the notification hours, as
 * `notificationHours[enabled]` and `notificationHours[days][day] = ['09:00-17:00']`, with the browser's `timezone`.
 */
class UpdatePreferencesRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'preferences' => ['required_without_all:channels,frequencies,notificationHours', 'array'],
            'preferences.*' => ['array'],
            'preferences.*.*' => ['boolean'],
            'channels' => ['required_without_all:preferences,frequencies,notificationHours', 'array'],
            'channels.*' => ['boolean'],
            'frequencies' => ['required_without_all:preferences,channels,notificationHours', 'array'],
            'frequencies.*' => ['string', Rule::in(NotificationPreferences::offeredFrequencies())],
            'notificationHours' => ['required_without_all:preferences,channels,frequencies', 'array'],
            'notificationHours.enabled' => ['boolean'],
            'notificationHours.days' => [Rule::array(NotificationHours::DAYS)],
            'notificationHours.days.*' => ['list'],
            'notificationHours.days.*.*' => ['string', 'regex:'.NotificationHours::RANGE_PATTERN],
            'timezone' => ['nullable', 'string', 'timezone:all_with_bc'],
        ];
    }

    /**
     * Get the "after" validation callables for the request.
     *
     * @return list<Closure(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isEmpty() && $this->leavesNoNotificationHours()) {
                    $validator->errors()->add(
                        'notificationHours.days',
                        'The notification hours must have a range on at least one day.',
                    );
                }
            },
        ];
    }

    /**
     * Get the choices that the request sends, by category and channel.
     *
     * @return array<string, array<string, bool>>
     */
    public function categories(): array
    {
        /** @var array<string, array<string, bool|int|string>> $preferences */
        $preferences = $this->validated('preferences', []);

        return array_map(
            fn (array $channels): array => array_map(boolval(...), $channels),
            $preferences,
        );
    }

    /**
     * Get the switches of channels for every category that the request sends.
     *
     * @return array<string, bool>
     */
    public function channels(): array
    {
        /** @var array<string, bool|int|string> $channels */
        $channels = $this->validated('channels', []);

        return array_map(boolval(...), $channels);
    }

    /**
     * Get the digest frequencies that the request sends, by category.
     *
     * @return array<string, string>
     */
    public function frequencies(): array
    {
        return $this->validated('frequencies', []);
    }

    /**
     * Get the timezone of the user's browser.
     */
    public function timezone(): ?string
    {
        return $this->validated('timezone');
    }

    /**
     * Get the changes of the notification hours that the request sends, or null when it sends none.
     */
    public function notificationHours(): ?NotificationHoursChange
    {
        /** @var array{enabled?: bool|int|string, days?: array<string, list<string>>} $changes */
        $changes = Arr::only($this->validated('notificationHours', []), ['enabled', 'days']);

        if ($changes === []) {
            return null;
        }

        return new NotificationHoursChange(
            enabled: array_key_exists('enabled', $changes) ? (bool) $changes['enabled'] : null,
            days: $changes['days'] ?? null,
        );
    }

    /**
     * Determine if the notification hours that the request sends leave the user without a range on any day.
     *
     * The application saves no notification hours while it does not offer them, so they pass as they are.
     */
    protected function leavesNoNotificationHours(): bool
    {
        $changes = $this->notificationHours();
        $user = $this->user();

        if (! $changes instanceof NotificationHoursChange || ! NotificationHours::offered()) {
            return false;
        }

        if (! $user instanceof Model) {
            return false;
        }

        return ! NotificationPreferences::notificationHours($user)
            ->withChanges($changes)
            ->hasRanges();
    }
}
