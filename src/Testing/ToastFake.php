<?php

namespace InertiaUI\Notifications\Testing;

use Closure;
use Illuminate\Support\Str;
use InertiaUI\Notifications\Toast;
use PHPUnit\Framework\Assert as PHPUnit;

/**
 * Records the toasts that are sent while `Toast::fake()` is active.
 */
class ToastFake
{
    /**
     * The recorded toasts.
     *
     * @var list<Toast>
     */
    protected array $toasts = [];

    /**
     * Record the given toast.
     */
    public function record(Toast $toast): void
    {
        $this->toasts[] = $toast;
    }

    /**
     * Get the recorded toasts that match a title or callback.
     *
     * The toasts are in the order they were sent.
     *
     * @param  (Closure(Toast): bool)|string|null  $callback
     * @return list<Toast>
     */
    public function flashed(Closure|string|null $callback = null): array
    {
        if ($callback === null) {
            return $this->toasts;
        }

        $matches = is_string($callback) ? fn (Toast $toast): bool => $toast->getTitle() === $callback : $callback;

        return collect($this->toasts)
            ->filter(fn (Toast $toast): bool => (bool) $matches($toast))
            ->values()
            ->all();
    }

    /**
     * Assert if a toast was flashed based on its title or a truth-test callback.
     *
     * @param  (Closure(Toast): bool)|string|null  $callback
     */
    public function assertFlashed(Closure|string|null $callback = null, ?int $times = null): void
    {
        $count = count($this->flashed($callback));
        $description = is_string($callback) ? "a toast titled [{$callback}]" : 'a matching toast';

        if ($times === null) {
            PHPUnit::assertGreaterThan(0, $count, "Expected {$description} to be flashed. Flashed: {$this->titles()}.");

            return;
        }

        $timesWord = Str::plural('time', $times);
        $countWord = Str::plural('time', $count);

        PHPUnit::assertSame(
            $times,
            $count,
            "Expected {$description} to be flashed {$times} {$timesWord}, but it was flashed {$count} {$countWord}.",
        );
    }

    /**
     * Assert if a toast was not flashed based on its title or a truth-test callback.
     *
     * @param  (Closure(Toast): bool)|string  $callback
     */
    public function assertNotFlashed(Closure|string $callback): void
    {
        $description = is_string($callback) ? "a toast titled [{$callback}]" : 'a matching toast';

        PHPUnit::assertCount(0, $this->flashed($callback), "Expected {$description} not to be flashed.");
    }

    /**
     * Assert that no toasts were flashed.
     */
    public function assertNothingFlashed(): void
    {
        PHPUnit::assertSame([], $this->toasts, "Expected no toasts to be flashed. Flashed: {$this->titles()}.");
    }

    /**
     * Get the titles of the recorded toasts for the failure messages.
     */
    protected function titles(): string
    {
        if ($this->toasts === []) {
            return 'none';
        }

        return collect($this->toasts)
            ->map(fn (Toast $toast): string => "[{$toast->getTitle()}]")
            ->implode(', ');
    }
}
