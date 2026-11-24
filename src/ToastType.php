<?php

namespace InertiaUI\Notifications;

use InvalidArgumentException;

enum ToastType: string
{
    case Default = 'default';
    case Success = 'success';
    case Info = 'info';
    case Warning = 'warning';
    case Error = 'error';
    case Loading = 'loading';

    /**
     * Resolve the given value to a built-in type or the name of a custom type.
     *
     * The Toaster shows a custom type, such as `deployment`, with the icon and screen reader label given for it, and
     * sets it as the toast's `data-type` attribute.
     *
     * @throws InvalidArgumentException
     */
    public static function resolve(self|string $type): self|string
    {
        if ($type instanceof self) {
            return $type;
        }

        if (preg_match('/^[a-z][a-z0-9-]*\z/', $type) !== 1) {
            throw new InvalidArgumentException(
                "[{$type}] is not a valid toast type. Use lowercase letters, digits, and dashes, with a letter first."
            );
        }

        return self::tryFrom($type) ?? $type;
    }

    /**
     * Get the value of the given built-in or custom type, as the frontend receives it.
     */
    public static function value(self|string $type): string
    {
        return $type instanceof self ? $type->value : $type;
    }
}
