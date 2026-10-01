<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Record when a customer agreed to the privacy notice.
 *
 * The Data Privacy Act asks for consent that is "evidenced by written,
 * electronic or recorded means". A tick box that leaves nothing behind
 * cannot be evidence of anything, so the moment of agreement is stored on
 * the account itself.
 *
 * Nullable on purpose: accounts created before this existed never gave that
 * consent, and marking them as though they had would be a false record. A
 * null here means consent has not been captured, not that it was refused.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'privacy_consent_at')) {
                $table->timestamp('privacy_consent_at')->nullable()->after('birthdate');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'privacy_consent_at')) {
                $table->dropColumn('privacy_consent_at');
            }
        });
    }
};
