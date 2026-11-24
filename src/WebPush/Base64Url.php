<?php

namespace InertiaUI\Notifications\WebPush;

use InvalidArgumentException;

/**
 * Encodes and decodes the URL-safe base64 without padding that Web Push uses for keys, secrets, and tokens.
 */
class Base64Url
{
    /**
     * Encode the given bytes.
     */
    public static function encode(string $bytes): string
    {
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }

    /**
     * Decode the given value.
     *
     * @throws InvalidArgumentException
     */
    public static function decode(string $value): string
    {
        $bytes = base64_decode(strtr($value, '-_', '+/'), true);

        // The value may be the VAPID private key, and a malformed key is usually the real key with one
        // bad character, so we will leave the value out of the message, which reaches logs and pages.
        if ($bytes === false) {
            throw new InvalidArgumentException('The value must be URL-safe base64.');
        }

        return $bytes;
    }
}
