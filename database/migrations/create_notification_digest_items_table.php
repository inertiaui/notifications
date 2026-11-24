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
        $name = config('inertia-notifications.digests.table', 'notification_digest_items');

        // Every index has a name, so a table prefix of up to 21 characters keeps it within MySQL's and PostgreSQL's
        // limits. Laravel adds the table prefix to the index names it generates while the connection's prefix_indexes
        // option is on, and we will do the same, so two prefixes can share a database.
        $prefix = DB::getConfig('prefix_indexes') ? DB::getTablePrefix() : '';

        Schema::create($name, function (Blueprint $table) use ($prefix): void {
            $table->id();
            // Use uuidMorphs() or ulidMorphs() when your notifiable models have UUID or ULID keys.
            $table->morphs('notifiable', "{$prefix}notification_digest_items_notifiable_index");
            // The ID of the Laravel notification, which is also the ID of its row in the notification center.
            $table->uuid('notification_id');
            $table->string('type');
            $table->string('category', 100);
            // The Laravel channel that the digest sends the notification through, such as "mail".
            $table->string('channel', 100);
            $table->json('data');
            // Set by InboxMessage::unlessReadWithin(), which leaves the notification out once it has been read.
            $table->boolean('unless_read')->default(false);
            // Set when the inbox channel stores the notification, so the digest leaves it out once it is retracted.
            $table->boolean('in_inbox')->default(false);
            // The time of the digest that the notification belongs to, before the notification hours or a pause
            // move it, or the time it was held when the user receives its category right away.
            $table->dateTime('digest_at');
            // The send-digests command sends the digests whose time has come every minute.
            $table->dateTime('send_at')->index("{$prefix}notification_digest_items_send_at_index");
            $table->datetimes();

            $table->unique(
                ['notifiable_type', 'notifiable_id', 'notification_id', 'channel'],
                "{$prefix}notification_digest_items_unique",
            );
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists(config('inertia-notifications.digests.table', 'notification_digest_items'));
    }
};
