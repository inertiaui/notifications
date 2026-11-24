<?php

namespace InertiaUI\Notifications\Console\Concerns;

/**
 * Tells the web push commands how to enable push, naming the published configuration file or the command that
 * publishes it.
 */
trait ExplainsHowToEnablePush
{
    /**
     * Get the instruction that enables push, which names the configuration file, or the command that publishes it
     * while it is not published.
     */
    protected function enablePushInstruction(): string
    {
        $file = file_exists(config_path('inertia-notifications.php'))
            ? 'config/inertia-notifications.php'
            : 'the configuration, published with [php artisan vendor:publish --tag=inertia-notifications-config]';

        return "Set ['enabled' => true] in the 'push' section of {$file}.";
    }
}
