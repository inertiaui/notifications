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
        $name = config('inertia-notifications.inbox.table', 'inbox_notifications');
        $mutes = config('inertia-notifications.inbox.mutes_table', 'inbox_mutes');

        // Every index has a name, so a table prefix of up to 21 characters keeps it within MySQL's and PostgreSQL's
        // limits. Laravel adds the table prefix to the index names it generates while the connection's prefix_indexes
        // option is on, and we will do the same, so two prefixes can share a database.
        $prefix = DB::getConfig('prefix_indexes') ? DB::getTablePrefix() : '';

        Schema::create($name, function (Blueprint $table) use ($prefix): void {
            // The ID of the Laravel notification, which every channel of one notification shares.
            $table->uuid('id')->primary();
            // Use uuidMorphs() or ulidMorphs() when your notifiable models have UUID or ULID keys.
            $table->morphs('notifiable', "{$prefix}inbox_notifications_notifiable_index");
            $table->string('type');
            $table->string('category')->nullable();
            $table->string('group_key')->nullable();
            // Set by InboxMessage::once(), so the notifiable model receives the notification only once.
            $table->string('unique_key')->nullable();
            // Set by InboxMessage::for(), such as the team the notification belongs to.
            // Use nullableUuidMorphs() or nullableUlidMorphs() when your context models have UUID or ULID keys.
            $table->nullableMorphs('context', "{$prefix}inbox_notifications_context_index");
            // The message: its title, body, actions, and the data of InboxMessage::with().
            $table->json('data');
            // Set by every delivery: over the throttle of its category, or outside the notification hours
            // or during a pause.
            $table->boolean('throttled')->default(false);
            $table->boolean('quiet')->default(false);
            $table->dateTime('read_at')->nullable();
            $table->dateTime('seen_at')->nullable();
            $table->dateTime('archived_at')->nullable();
            // The unsnooze command looks up the notifications whose time has come every minute.
            $table->dateTime('snoozed_until')->nullable()->index("{$prefix}inbox_notifications_snoozed_until_index");
            // Set once an action with a result ran, or by Inbox::complete(), such as "Approved".
            $table->json('result')->nullable();
            // Set by InboxMessage::collapse(): later notifications of the group key collapse into the row until then.
            $table->dateTime('collapses_until')->nullable();
            // Set when the message collapses: the IDs of the notifications in the row, and their newest actors.
            $table->json('collapsed')->nullable();
            $table->datetimes();

            $table->index(
                ['notifiable_type', 'notifiable_id', 'archived_at', 'created_at'],
                "{$prefix}inbox_notifications_list_index",
            );

            $table->index(['notifiable_type', 'notifiable_id', 'read_at'], "{$prefix}inbox_notifications_read_index");

            $table->unique(
                ['notifiable_type', 'notifiable_id', 'unique_key'],
                "{$prefix}inbox_notifications_unique_key",
            );

            // Inbox::complete() and the other changes by key look up the notifications of every user.
            $table->index('unique_key', "{$prefix}inbox_notifications_key_index");

            $table->index(
                ['notifiable_type', 'notifiable_id', 'group_key', 'collapses_until'],
                "{$prefix}inbox_notifications_collapse_index",
            );
        });

        // The threads that each notifiable model muted, by group key. Later notifications of a muted thread
        // reach the notifiable model only when they mention it or belong to a locked category.
        Schema::create($mutes, function (Blueprint $table) use ($prefix): void {
            $table->id();
            // Use uuidMorphs() or ulidMorphs() when your notifiable models have UUID or ULID keys.
            $table->morphs('notifiable', "{$prefix}inbox_mutes_notifiable_index");
            $table->string('group_key');
            $table->datetimes();

            $table->unique(['notifiable_type', 'notifiable_id', 'group_key'], "{$prefix}inbox_mutes_unique_key");
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists(config('inertia-notifications.inbox.mutes_table', 'inbox_mutes'));
        Schema::dropIfExists(config('inertia-notifications.inbox.table', 'inbox_notifications'));
    }
};
