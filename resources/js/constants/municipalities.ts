/**
 * The towns the shop delivers to. This is the only list: it fills the
 * municipality dropdown at checkout and in profile settings, and the
 * "We deliver to" section on the landing page reads it too, so the page
 * cannot promise an area the order form would refuse.
 *
 * These strings are stored on orders (delivery_municipality) and on saved
 * addresses (user_addresses.municipality), so changing one is a data change,
 * not just a label — see the migration that renamed Penaranda to Peñaranda.
 */
export const IN_TOWN_MUNICIPALITY = 'Peñaranda';

export const MUNICIPALITIES = [
    'Peñaranda',
    'General Tinio',
    'Gapan City',
    'San Leonardo',
    'Santa Rosa',
    'Jaen',
];

/**
 * Local names a town is better known by, shown only on the landing page so
 * someone searching for their own area recognises it. Never stored.
 */
export const MUNICIPALITY_ALSO_KNOWN_AS: Record<string, string> = {
    'General Tinio': 'Papaya',
};
