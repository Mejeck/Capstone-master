// Mirrors DeliveryFeeSetting::IN_TOWN_MUNICIPALITY on the server.
export const IN_TOWN_MUNICIPALITY = 'Peñaranda';

// Matches DeliveryFeeSetting::isInTown: the town has been stored both with
// and without the tilde, so fold it before comparing.
export const normaliseTown = (value: string | null | undefined) =>
    (value ?? '').trim().toLowerCase().replace(/ñ/g, 'n');

export const isInTown = (municipality: string | null | undefined, inTownMunicipality = IN_TOWN_MUNICIPALITY) =>
    normaliseTown(municipality) !== '' && normaliseTown(municipality) === normaliseTown(inTownMunicipality);

// "Delivery Fee (Peñaranda, in-town)" — says where the fee comes from.
export const deliveryFeeLabel = (municipality: string | null | undefined, inTownMunicipality = IN_TOWN_MUNICIPALITY) => {
    const town = (municipality ?? '').trim();
    if (!town) return 'Delivery Fee';
    return `Delivery Fee (${town}, ${isInTown(town, inTownMunicipality) ? 'in-town' : 'out-of-town'})`;
};
