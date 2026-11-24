<?php

namespace Database\Seeders;

use App\Models\User;
use App\Notifications\DemoNotification;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        DemoNotification::fill(User::demo(), 30);
    }
}
