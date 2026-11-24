<?php

namespace InertiaUI\Notifications\Tests\Fixtures;

/**
 * An audience of announcements: the users with one of the given names.
 */
class NamedUsers
{
    /**
     * Determine if the user has one of the given names.
     */
    public function __invoke(User $user, string ...$names): bool
    {
        return in_array($user->name, $names, true);
    }
}
