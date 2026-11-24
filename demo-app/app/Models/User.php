<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;
use InertiaUI\Notifications\Concerns\HasInbox;

class User extends Authenticatable
{
    use HasInbox, Notifiable;

    protected $guarded = [];

    protected $hidden = ['password'];

    protected function casts(): array
    {
        return ['password' => 'hashed'];
    }

    /**
     * The user every demo request is signed in as.
     */
    public static function demo(): self
    {
        return self::query()->firstOrCreate(['email' => 'demo@inertiaui.test'], ['name' => 'Demo User', 'password' => Str::random(32)]);
    }
}
