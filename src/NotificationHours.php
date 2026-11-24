<?php

namespace InertiaUI\Notifications;

use Carbon\CarbonInterface;
use Illuminate\Contracts\Support\Arrayable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use InvalidArgumentException;
use JsonSerializable;

/**
 * The hours of each day of the week when notifications reach a notifiable model, in its own timezone. Outside
 * them, the channels that digests hold wait until the next notification hours start, and the notification
 * center shows no toast, sound, or alert. `DoNotDisturb` combines them with the notifiable model's pause.
 *
 * @implements Arrayable<string, mixed>
 */
class NotificationHours implements Arrayable, JsonSerializable
{
    /**
     * The days of the week, starting on Monday.
     */
    public const array DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    /**
     * The pattern of a range of two times of day, such as `09:00-17:00`.
     */
    public const string RANGE_PATTERN = '/^([01]\d|2[0-3]):[0-5]\d\-([01]\d|2[0-3]):[0-5]\d\z/';

    /**
     * The time that ends a day, for the ranges that run past midnight.
     */
    protected const string END_OF_DAY = '24:00';

    /**
     * The number of days to look through for the start of the next range, today included.
     */
    protected const int DAYS_TO_LOOK_AHEAD = 8;

    /**
     * Create a new notification hours instance.
     *
     * @param  bool  $enabled  Whether the notifiable model turned its notification hours on.
     * @param  array<string, list<string>>  $days  The ranges of each day of the week, such as `09:00-17:00`.
     */
    public function __construct(
        public readonly bool $enabled,
        public readonly array $days,
    ) {}

    /**
     * Determine if the application lets users set notification hours.
     */
    public static function offered(): bool
    {
        return (bool) config('inertia-notifications.notification_hours.enabled', false);
    }

    /**
     * Determine if notifications reach the notifiable model at the given time, or now.
     *
     * Notifications always reach it while the application does not offer notification hours, and while
     * the notifiable model turned them off.
     */
    public static function within(Model $notifiable, ?CarbonInterface $at = null): bool
    {
        return NotificationPreferences::doNotDisturb($notifiable)->withinNotificationHours($at ?? now());
    }

    /**
     * Get the given time when notifications reach the notifiable model at that time, or else the start of
     * its next range, in the application's timezone.
     */
    public static function next(Model $notifiable, CarbonInterface $time): CarbonInterface
    {
        return NotificationPreferences::doNotDisturb($notifiable)->nextNotificationHours($time);
    }

    /**
     * Ensure the given value is a range of two times of day, such as `09:00-17:00`.
     *
     * @throws InvalidArgumentException
     */
    public static function ensureRange(string $range): void
    {
        if (! preg_match(self::RANGE_PATTERN, $range)) {
            throw new InvalidArgumentException(
                "The notification hours range [{$range}] must be two times of day, such as 09:00-17:00.",
            );
        }
    }

    /**
     * Ensure the given day is a day of the week, such as `monday`, and each of the given ranges of that day
     * is a range of two times of day.
     *
     * @param  list<string>  $ranges
     *
     * @throws InvalidArgumentException
     */
    public static function ensureRanges(string $day, array $ranges): void
    {
        self::ensureDay($day);

        foreach ($ranges as $range) {
            self::ensureRange($range);
        }
    }

    /**
     * Get a copy of the notification hours with the given changes, with the ranges of each changed day
     * sorted by their start.
     *
     * @throws InvalidArgumentException
     */
    public function withChanges(NotificationHoursChange $changes): self
    {
        $days = $this->days;

        foreach ($changes->days ?? [] as $day => $ranges) {
            self::ensureRanges($day, $ranges ?? []);

            if ($ranges === null) {
                continue;
            }

            $days[$day] = collect($ranges)
                ->sort()
                ->values()
                ->all();
        }

        return new self($changes->enabled ?? $this->enabled, $days);
    }

    /**
     * Determine if the notification hours have a range on any day.
     */
    public function hasRanges(): bool
    {
        return collect($this->days)
            ->flatten()
            ->isNotEmpty();
    }

    /**
     * Ensure the given value is a day of the week, such as `monday`.
     *
     * @throws InvalidArgumentException
     */
    protected static function ensureDay(string $day): void
    {
        if (! in_array($day, self::DAYS, true)) {
            throw new InvalidArgumentException(
                "The notification hours day [{$day}] must be a day of the week, such as monday.",
            );
        }
    }

    /**
     * Determine if the given time falls inside a range, in the given timezone.
     */
    public function includes(CarbonInterface $time, string $timezone): bool
    {
        $local = $time->copy()->setTimezone($timezone);
        $clock = $local->format('H:i');

        return collect($this->hoursOn($local))
            ->contains(fn (array $hours): bool => $clock >= $hours[0] && $clock < $hours[1]);
    }

    /**
     * Get the hours of the given day as pairs of a start and an end time.
     *
     * A range that ends before it starts runs past midnight, so it lasts until the end of its own day,
     * and those ranges of the day before last from the start of the given day until their end.
     *
     * @return list<array{string, string}>
     */
    protected function hoursOn(CarbonInterface $date): array
    {
        $hours = [];

        foreach ($this->rangesOn($date->copy()->subDay()) as $range) {
            [$start, $end] = explode('-', $range);

            if ($end <= $start) {
                $hours[] = ['00:00', $end];
            }
        }

        foreach ($this->rangesOn($date) as $range) {
            [$start, $end] = explode('-', $range);
            $hours[] = [$start, $end <= $start ? self::END_OF_DAY : $end];
        }

        return $hours;
    }

    /**
     * Get the start of the first range after the given time, in the given timezone.
     *
     * Every week has a range, so the days up to the same weekday of the next week hold the next start.
     */
    public function nextStart(CarbonInterface $time, string $timezone): CarbonInterface
    {
        $today = $time->copy()
            ->setTimezone($timezone)
            ->startOfDay();

        for ($offset = 0; $offset < self::DAYS_TO_LOOK_AHEAD; $offset++) {
            $start = $this->firstStartAfter($today->copy()->addDays($offset), $time);

            if ($start instanceof CarbonInterface) {
                return $start;
            }
        }

        return $time->copy();
    }

    /**
     * Get the earliest start of the given day's ranges that comes after the given time.
     */
    protected function firstStartAfter(CarbonInterface $date, CarbonInterface $time): ?CarbonInterface
    {
        return collect($this->rangesOn($date))
            ->map(fn (string $range): CarbonInterface => $date->copy()->setTimeFromTimeString(Str::before($range, '-')))
            ->filter(fn (CarbonInterface $start): bool => $start->greaterThan($time))
            ->sortBy(fn (CarbonInterface $start): int => $start->getTimestamp())
            ->first();
    }

    /**
     * Get the ranges of the day of the week that the given date falls on.
     *
     * @return list<string>
     */
    protected function rangesOn(CarbonInterface $date): array
    {
        return $this->days[self::DAYS[$date->dayOfWeekIso - 1]] ?? [];
    }

    /**
     * Get the instance as an array.
     *
     * @return array{enabled: bool, days: array<string, list<string>>}
     */
    public function toArray(): array
    {
        $days = [];

        foreach (self::DAYS as $day) {
            $days[$day] = $this->days[$day] ?? [];
        }

        return [
            'enabled' => $this->enabled,
            'days' => $days,
        ];
    }

    /**
     * Convert the object into something JSON serializable.
     *
     * @return array{enabled: bool, days: array<string, list<string>>}
     */
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
