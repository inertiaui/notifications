<?php

namespace InertiaUI\Notifications\Tests\Fixtures;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use InertiaUI\Notifications\Announcement;
use InertiaUI\Notifications\Concerns\HasInbox;

class User extends Authenticatable
{
    use HasInbox, Notifiable;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'users';

    /**
     * The attributes that aren't mass assignable.
     *
     * @var array<string>|bool
     */
    protected $guarded = [];

    /**
     * Create a user with the given name.
     */
    public static function named(string $name): self
    {
        return self::query()->create([
            'name' => $name,
            'email' => strtolower($name).'@acme.test',
            'password' => 'secret',
        ]);
    }

    /**
     * Define the audiences of the users with one of the given names, typed with `self` and with `parent`.
     */
    public static function defineNamedAudiences(): void
    {
        Announcement::defineAudience(
            'named-self',
            fn (self $user, string ...$names): bool => in_array($user->name, $names, true),
        );

        Announcement::defineAudience(
            'named-parent',
            fn (parent $user, string ...$names): bool => in_array($user->getAttribute('name'), $names, true),
        );
    }
}
