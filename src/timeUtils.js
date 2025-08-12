import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Compute the next run Date (UTC) for a reminder based on local time in timezone
 * @param {string} timeHHmm - e.g. "08:00"
 * @param {number[]} daysOfWeek - 0..6 (Sun..Sat), empty means every day
 * @param {string} tz - IANA timezone
 * @param {Date} [fromDate] - starting point (defaults to now)
 * @returns {Date} next run moment in UTC
 */
export function computeNextRunAt(timeHHmm, daysOfWeek = [], tz = 'UTC', fromDate = new Date()) {
  const [hh, mm] = (timeHHmm || '08:00').split(':').map((v) => parseInt(v, 10));
  let cursor = dayjs(fromDate).tz(tz);

  // Build today at specified time in user's TZ
  let target = cursor.hour(hh).minute(mm).second(0).millisecond(0);

  const activeDays = Array.isArray(daysOfWeek) && daysOfWeek.length > 0 ? new Set(daysOfWeek) : null;

  const isAllowedDay = (d) => (activeDays ? activeDays.has(d.day()) : true);

  // If target is in the past or day not allowed, advance day until valid
  if (!isAllowedDay(target)) {
    do {
      target = target.add(1, 'day').hour(hh).minute(mm).second(0).millisecond(0);
    } while (!isAllowedDay(target));
  } else if (target.isBefore(cursor)) {
    // Today at time already passed; go to next allowed day
    do {
      target = target.add(1, 'day').hour(hh).minute(mm).second(0).millisecond(0);
    } while (!isAllowedDay(target));
  }

  // Return as UTC Date
  return target.toDate();
}

