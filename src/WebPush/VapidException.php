<?php

namespace InertiaUI\Notifications\WebPush;

use RuntimeException;

/**
 * Thrown when web push needs VAPID keys and a subject that push services accept, with the way to fix them.
 */
class VapidException extends RuntimeException
{
    /**
     * Create a new exception for VAPID keys that are not set.
     */
    public static function missingKeys(): self
    {
        return new self(
            'Web push needs VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY, which are not set. '
            .'Run [php artisan inertia-notifications:vapid] to generate them.',
        );
    }

    /**
     * Create a new exception for VAPID keys that are no P-256 keys, for the given reason.
     */
    public static function invalidKeys(string $reason): self
    {
        return new self(
            "The VAPID keys are invalid: {$reason} "
            .'Run [php artisan inertia-notifications:vapid --force] to generate a new pair.',
        );
    }

    /**
     * Create a new exception for a VAPID public key and private key that do not belong together.
     */
    public static function mismatchedKeys(): self
    {
        return new self(
            'VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not one pair. Copy both keys from the same pair, '
            .'or run [php artisan inertia-notifications:vapid --force] to generate a new pair.',
        );
    }

    /**
     * Create a new exception for a VAPID subject that is not set.
     */
    public static function missingSubject(): self
    {
        return new self(
            'Web push needs VAPID_SUBJECT, which is not set. Set it in your .env file to a mailto: address or an '
            .'https:// URL where push services may reach you, such as [mailto:support@your-app.com].',
        );
    }

    /**
     * Create a new exception for the given VAPID subject, which is not a mailto: or https:// URL.
     */
    public static function invalidSubject(string $subject): self
    {
        return new self(
            "The VAPID subject [{$subject}] must be a mailto: address or an https:// URL, "
            .'such as [mailto:support@your-app.com]. Set VAPID_SUBJECT in your .env file.',
        );
    }
}
