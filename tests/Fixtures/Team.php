<?php

namespace InertiaUI\Notifications\Tests\Fixtures;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Notifiable;
use InertiaUI\Notifications\Concerns\HasInbox;

class Team extends Model
{
    use HasInbox, Notifiable;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'teams';

    /**
     * The attributes that aren't mass assignable.
     *
     * @var array<string>|bool
     */
    protected $guarded = [];
}
