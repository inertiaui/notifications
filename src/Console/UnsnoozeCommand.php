<?php

namespace InertiaUI\Notifications\Console;

use Illuminate\Console\Command;
use InertiaUI\Notifications\Inbox;
use Symfony\Component\Console\Attribute\AsCommand;

/**
 * Brings back snoozed notifications whose time has come, as new notifications at the top of the list.
 *
 * Schedule it every minute. Without it, they show again in their old place, with their old state.
 */
#[AsCommand(name: 'inertia-notifications:unsnooze')]
class UnsnoozeCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'inertia-notifications:unsnooze';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Bring back the snoozed notifications whose time has come';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $count = Inbox::unsnoozeDue();

        $this->components->info("Brought back {$count} snoozed notifications.");

        return self::SUCCESS;
    }
}
