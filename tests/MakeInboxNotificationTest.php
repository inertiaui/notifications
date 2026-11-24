<?php

use App\Notifications\InvoicePaid;
use Illuminate\Support\Facades\File;
use InertiaUI\Notifications\Tests\Fixtures\User;

afterEach(function (): void {
    File::deleteDirectory(app_path('Notifications'));
});

it('creates a notification that sends to the notification center', function (): void {
    $this->artisan('make:inbox-notification', ['name' => 'InvoicePaid'])
        ->assertSuccessful();

    require app_path('Notifications/InvoicePaid.php');

    $user = User::named('Pascal');

    $user->notify(new InvoicePaid);

    expect($user->inbox()->sole()->toInboxArray())->toMatchArray([
        'type' => InvoicePaid::class,
        'title' => 'The title of the notification.',
        'body' => 'The body of the notification.',
        'url' => url('/'),
    ]);
});
