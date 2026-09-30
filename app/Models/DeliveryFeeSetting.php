<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeliveryFeeSetting extends Model
{
    const IN_TOWN_MUNICIPALITY = 'Peñaranda';

    protected $fillable = [
        'in_town_fee',
        'out_of_town_fee',
    ];

    protected function casts(): array
    {
        return [
            'in_town_fee' => 'decimal:2',
            'out_of_town_fee' => 'decimal:2',
        ];
    }

    public static function current(): self
    {
        return self::firstOrCreate([], [
            'in_town_fee' => 20.00,
            'out_of_town_fee' => 30.00,
        ]);
    }

    public static function feeFor(?string $municipality): float
    {
        $settings = self::current();

        if ($municipality && self::isInTown($municipality)) {
            return (float) $settings->in_town_fee;
        }

        return (float) $settings->out_of_town_fee;
    }

    /**
     * The town's name is stored on every order and saved address, and it has
     * been written both ways: rows created before the tilde was added read
     * "Penaranda". A plain string comparison would treat those as out of
     * town and charge the home town the farther fee, so the tilde is folded
     * away before comparing and either spelling resolves to the same place.
     */
    public static function isInTown(?string $municipality): bool
    {
        return self::normaliseName($municipality) === self::normaliseName(self::IN_TOWN_MUNICIPALITY);
    }

    private static function normaliseName(?string $value): string
    {
        return mb_strtolower(str_replace(['ñ', 'Ñ'], ['n', 'N'], trim((string) $value)));
    }
}
