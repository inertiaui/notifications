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
        $announcements = config('inertia-notifications.inbox.announcements_table', 'inbox_announcements');
        $states = config('inertia-notifications.inbox.announcement_states_table', 'inbox_announcement_states');

        // Every index has a name, so a table prefix of up to 21 characters keeps it within MySQL's and PostgreSQL's
        // limits. Laravel adds the table prefix to the index names it generates while the connection's prefix_indexes
        // option is on, and we will do the same, so two prefixes can share a database.
        $prefix = DB::getConfig('prefix_indexes') ? DB::getTablePrefix() : '';

        Schema::create($announcements, function (Blueprint $table) use ($prefix): void {
            $table->uuid('id')->primary();
            // Set by Announcement::audience(): a defined audience or an invokable class, with its parameters.
            $table->string('audience')->nullable()->index("{$prefix}inbox_announcements_audience_index");
            $table->string('category')->nullable();
            // Set by Announcement::for(), such as the team whose members see the announcement.
            // Use nullableUuidMorphs() or nullableUlidMorphs() when your context models have UUID or ULID keys.
            $table->nullableMorphs('context', "{$prefix}inbox_announcements_context_index");
            $table->json('data');
            $table->dateTime('expires_at')->nullable()->index("{$prefix}inbox_announcements_expires_at_index");
            $table->datetimes();

            $table->index(['created_at', 'id'], "{$prefix}inbox_announcements_list_index");
        });

        // Each user's state of an announcement. A row is only stored once the user reads, archives,
        // snoozes, or deletes the announcement, so publishing one stores no rows for the users. The
        // lists join this table, so its columns do not share a name with the announcements table.
        Schema::create($states, function (Blueprint $table) use ($announcements, $prefix): void {
            $table->foreignUuid('announcement_id')
                ->constrained($announcements, indexName: "{$prefix}inbox_announcement_states_foreign")
                ->cascadeOnDelete();
            // Use uuidMorphs() or ulidMorphs() when your notifiable models have UUID or ULID keys.
            $table->morphs('notifiable', "{$prefix}inbox_announcement_states_notifiable_index");
            $table->dateTime('read_at')->nullable();
            $table->dateTime('seen_at')->nullable();
            $table->dateTime('archived_at')->nullable();
            $table->dateTime('snoozed_until')->nullable();
            $table->dateTime('dismissed_at')->nullable();

            $table->primary(['announcement_id', 'notifiable_type', 'notifiable_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $announcements = config('inertia-notifications.inbox.announcements_table', 'inbox_announcements');
        $states = config('inertia-notifications.inbox.announcement_states_table', 'inbox_announcement_states');

        Schema::dropIfExists($states);
        Schema::dropIfExists($announcements);
    }
};
