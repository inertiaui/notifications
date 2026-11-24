<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $name = config('inertia-notifications.preferences.table', 'notification_preferences');

        // Every index has a name, so a table prefix of up to 21 characters keeps it within MySQL's and PostgreSQL's
        // limits. Laravel adds the table prefix to the index names it generates while the connection's prefix_indexes
        // option is on, and we will do the same, so two prefixes can share a database.
        $prefix = DB::getConfig('prefix_indexes') ? DB::getTablePrefix() : '';

        Schema::create($name, function (Blueprint $table) use ($prefix): void {
            $table->id();
            // Use uuidMorphs() or ulidMorphs() when your notifiable models have UUID or ULID keys.
            $table->morphs('notifiable', "{$prefix}notification_preferences_notifiable_index");
            // The lengths keep the unique key within MySQL's 3072-byte limit, also with UUID or ULID keys.
            $table->string('category', 100);
            $table->string('channel', 100);
            // Null on the rows whose channel is `*`, which hold settings instead of a switch.
            $table->boolean('enabled')->nullable();
            // The digest frequency of a category, on the row whose channel is `*`.
            $table->json('settings')->nullable();
            $table->datetimes();

            $table->unique(
                ['notifiable_type', 'notifiable_id', 'category', 'channel'],
                "{$prefix}notification_preferences_unique",
            );
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists(config('inertia-notifications.preferences.table', 'notification_preferences'));
    }
};
