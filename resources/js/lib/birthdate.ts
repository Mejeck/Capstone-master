/**
 * Birthdate bounds for the date pickers, mirroring User::MINIMUM_SIGNUP_AGE
 * and User::EARLIEST_BIRTHDATE, which are what the server actually enforces.
 * Keeping them here means the register form and the profile form cannot drift
 * apart from each other.
 *
 * Note this is the age floor for holding an account, not the beverage age:
 * ordering beverages needs 18 and is checked separately through is_adult.
 */
export const MINIMUM_SIGNUP_AGE = 13;

export const EARLIEST_BIRTHDATE = '1900-01-01';

/**
 * The most recent birthdate that still meets the minimum signup age, as
 * YYYY-MM-DD for a date input's `max`.
 *
 * Built from local date parts rather than toISOString(), which converts to
 * UTC first and so can return the previous day in a UTC+8 timezone — landing
 * a day away from the boundary the backend checks.
 */
export function latestAllowedBirthdate(): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() - MINIMUM_SIGNUP_AGE);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
