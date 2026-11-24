<?php

namespace InertiaUI\Notifications\Console;

use Illuminate\Console\Command;
use InertiaUI\Notifications\Digest;
use Symfony\Component\Console\Attribute\AsCommand;

/**
 * Sends the digests whose time has come, one per user, with the notifications that were held for them.
 *
 * Schedule it every minute, since each user receives their digests at the time in their own timezone.
 */
#[AsCommand(name: 'inertia-notifications:send-digests')]
class SendDigestsCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'inertia-notifications:send-digests';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send the notification digests whose time has come';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $count = Digest::sendDue();

        $this->components->info("Sent {$count} digests.");

        return self::SUCCESS;
    }
}
