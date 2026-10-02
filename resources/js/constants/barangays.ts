// Barangays of each municipality the shop delivers to (MUNICIPALITIES in
// ./municipalities.ts), sourced from the PSA's Philippine Standard
// Geographic Code. Used only to auto-fill the Municipality field from a
// typed Barangay — never stored or validated against, so an unlisted or
// newly-renamed barangay just falls back to manual selection instead of
// blocking the order.
const BARANGAYS_BY_MUNICIPALITY: Record<string, string[]> = {
    'Peñaranda': [
        'Callos', 'Las Piñas', 'Poblacion I', 'Poblacion II', 'Poblacion III',
        'Poblacion IV', 'San Josef', 'San Mariano', 'Santo Tomas', 'Sinasajan',
    ],
    'General Tinio': [
        'Bago', 'Concepcion', 'Nazareth', 'Padolina', 'Palale', 'Pias',
        'Poblacion Central', 'Poblacion East', 'Poblacion West', 'Pulong Matong',
        'Rio Chico', 'Sampaguita', 'San Pedro',
    ],
    'Gapan City': [
        'Balante', 'Bayanihan', 'Bulak', 'Bungo', 'Kapalangan', 'Mabunga',
        'Maburak', 'Mahipon', 'Makabaclay', 'Malimba', 'Mangino', 'Marelo',
        'Pambuan', 'Parcutela', 'Puting Tubig', 'San Lorenzo', 'San Nicolas',
        'San Roque', 'San Vicente', 'Santa Cruz', 'Santo Cristo Norte',
        'Santo Cristo Sur', 'Santo Niño',
    ],
    'San Leonardo': [
        'Bonifacio District', 'Burgos District', 'Castellano', 'Diversion',
        'Magpapalayoc', 'Mallorca', 'Mambangnan', 'Nieves', 'Rizal District',
        'San Anton', 'San Bartolome', 'San Roque', 'Tabuating', 'Tagumpay',
        'Tambo Adorable',
    ],
    'Santa Rosa': [
        'Aguinaldo', 'Berang', 'Burgos', 'Cojuangco', 'Del Pilar', 'Gomez',
        'Inspector', 'Isla', 'La Fuente', 'Liwayway', 'Lourdes', 'Luna',
        'Mabini', 'Malacañang', 'Maliolio', 'Mapalad', 'Rajal Centro',
        'Rajal Norte', 'Rajal Sur', 'Rizal', 'San Gregorio', 'San Isidro',
        'San Josep', 'San Mariano', 'San Pedro', 'Santa Teresita',
        'Santo Rosario', 'Sapsap', 'Soledad', 'Tagpos', 'Tramo', 'Valenzuela',
        'Zamora',
    ],
    'Jaen': [
        'Calabasa', 'Dampulan', 'Don Mariano Marcos', 'Hilera', 'Imbunia',
        'Imelda Poblacion', 'Lambakin', 'Langla', 'Magsalisi', 'Malabon-Kaingin',
        'Marawa', 'Niyugan', 'Ocampo-Rivera District', 'Pakol', 'Pamacpacan',
        'Pinanggaan', 'Putlod', 'San Jose', 'San Josef', 'San Pablo',
        'San Roque', 'San Vicente', 'Santa Rita', 'Santo Tomas North',
        'Santo Tomas South', 'Sapang', 'Ulanin-Pitak',
    ],
};

// Precomputed so a barangay like "San Roque" — which exists in three of
// these towns — correctly maps to `null` (ambiguous) instead of silently
// picking whichever municipality happened to be listed first.
const MUNICIPALITY_BY_BARANGAY: Record<string, string | null> = {};
for (const [municipality, barangays] of Object.entries(BARANGAYS_BY_MUNICIPALITY)) {
    for (const barangay of barangays) {
        const key = barangay.trim().toLowerCase();
        MUNICIPALITY_BY_BARANGAY[key] = key in MUNICIPALITY_BY_BARANGAY ? null : municipality;
    }
}

/**
 * Returns the one municipality a typed barangay name belongs to, or null if
 * it doesn't exactly match a known barangay (case-insensitive) or matches
 * more than one town (several of these barangay names repeat across towns).
 */
export function findMunicipalityForBarangay(barangayInput: string): string | null {
    const key = barangayInput.trim().toLowerCase();
    if (!key) return null;
    return MUNICIPALITY_BY_BARANGAY[key] ?? null;
}
