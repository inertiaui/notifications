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
        $name = config('inertia-notifications.push.table', 'push_subscriptions');

        // Every index has a name, so a table prefix of up to 21 characters keeps it within MySQL's and PostgreSQL's
        // limits. Laravel adds the table prefix to the index names it generates while the connection's prefix_indexes
        // option is on, and we will do the same, so two prefixes can share a database.
        $prefix = DB::getConfig('prefix_indexes') ? DB::getTablePrefix() : '';

        Schema::create($name, function (Blueprint $table) use ($prefix): void {
            $table->id();
            // Use uuidMorphs() or ulidMorphs() when your notifiable models have UUID or ULID keys.
            $table->morphs('notifiable', "{$prefix}push_subscriptions_notifiable_index");
            // Endpoints may be longer than MySQL can index, so the unique key is on their SHA-256 hash.
            $table->text('endpoint');
            $table->char('endpoint_hash', 64)->unique("{$prefix}push_subscriptions_endpoint_hash_unique");
            // The keys that the browser decrypts each push with, as URL-safe base64.
            $table->string('p256dh');
            $table->string('auth');
            $table->text('user_agent')->nullable();
            $table->dateTime('expires_at')->nullable();
            // The VAPID public key that the browser subscribed with. After the keys change, the push
            // services refuse the subscriptions made with the previous key, until they are renewed.
            $table->string('vapid_public_key');
            $table->datetimes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists(config('inertia-notifications.push.table', 'push_subscriptions'));
    }
};
