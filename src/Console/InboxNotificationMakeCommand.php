<?php

namespace InertiaUI\Notifications\Console;

use Illuminate\Console\GeneratorCommand;
use Symfony\Component\Console\Attribute\AsCommand;

/**
 * Creates a notification class that sends to the notification center.
 */
#[AsCommand(name: 'make:inbox-notification')]
class InboxNotificationMakeCommand extends GeneratorCommand
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'make:inbox-notification
                    {name : The name of the notification}
                    {--f|force : Create the class even if the notification already exists}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create a new notification class for the notification center';

    /**
     * The type of class being generated.
     *
     * @var string
     */
    protected $type = 'Notification';

    /**
     * Get the stub file for the generator.
     */
    protected function getStub(): string
    {
        return __DIR__.'/../../stubs/inbox-notification.stub';
    }

    /**
     * Get the default namespace for the class.
     *
     * @param  string  $rootNamespace
     */
    protected function getDefaultNamespace($rootNamespace): string
    {
        return "{$rootNamespace}\\Notifications";
    }
}
