/**
 * Timezone Utility Functions
 *
 * Converts between Swedish time (Europe/Stockholm) and UTC
 * Swedish time: UTC+1 (winter) / UTC+2 (summer)
 */

/**
 * Convert Swedish time (HH:MM) to UTC time (HH:MM)
 *
 * @param swedishTime - Time in Swedish timezone (e.g., "10:00")
 * @returns Time in UTC (e.g., "08:00" in summer, "09:00" in winter)
 */
export function swedishToUTC(swedishTime: string): string {
  if (!swedishTime || !swedishTime.includes(':')) {
    return swedishTime;
  }

  const [hours, minutes] = swedishTime.split(':').map(Number);

  // Create a date object with today's date and the specified time in Swedish timezone
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  // Get the timezone offset for Europe/Stockholm
  // This automatically handles DST (daylight saving time)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Stockholm',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const formatterUTC = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // Create a full date-time string for today at the specified time
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  // Create date string in Swedish timezone
  const dateTimeString = `${year}-${month}-${day}T${swedishTime}:00`;
  const dateInSwedishTZ = new Date(dateTimeString);

  // Calculate offset between Swedish time and UTC
  // Swedish time is UTC+1 (winter) or UTC+2 (summer)
  const offset = getStockholmOffset(dateInSwedishTZ);

  // Convert to UTC by subtracting the offset
  const utcHours = (hours - offset + 24) % 24;

  return `${String(utcHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Convert UTC time (HH:MM) to Swedish time (HH:MM)
 *
 * @param utcTime - Time in UTC (e.g., "08:00")
 * @returns Time in Swedish timezone (e.g., "10:00" in summer, "09:00" in winter)
 */
export function utcToSwedish(utcTime: string): string {
  if (!utcTime || !utcTime.includes(':')) {
    return utcTime;
  }

  const [hours, minutes] = utcTime.split(':').map(Number);

  // Calculate offset for Stockholm
  const now = new Date();
  const offset = getStockholmOffset(now);

  // Convert from UTC to Swedish time by adding the offset
  const swedishHours = (hours + offset) % 24;

  return `${String(swedishHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Get the current UTC offset for Stockholm timezone
 * Returns 1 for winter (standard time), 2 for summer (DST)
 *
 * @param date - Date to check offset for
 * @returns Offset in hours (1 or 2)
 */
function getStockholmOffset(date: Date): number {
  // Create two formatters - one for Stockholm, one for UTC
  const stockholmFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Stockholm',
    hour: 'numeric',
    hour12: false,
  });

  const utcFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    hour: 'numeric',
    hour12: false,
  });

  // Get hours in both timezones
  const stockholmHour = parseInt(stockholmFormatter.format(date));
  const utcHour = parseInt(utcFormatter.format(date));

  // Calculate offset (accounting for day boundary)
  let offset = stockholmHour - utcHour;

  // Handle day boundary cases
  if (offset < -12) offset += 24;
  if (offset > 12) offset -= 24;

  return offset;
}

/**
 * Check if a date is in Swedish summer time (DST)
 *
 * @param date - Date to check
 * @returns true if DST is active, false otherwise
 */
export function isSwedishSummerTime(date: Date = new Date()): boolean {
  return getStockholmOffset(date) === 2;
}

/**
 * Get a human-readable description of current Swedish time offset
 *
 * @returns Description string (e.g., "UTC+2 (sommartid)")
 */
export function getSwedishTimeDescription(): string {
  const offset = getStockholmOffset(new Date());
  const season = offset === 2 ? 'sommartid' : 'vintertid';
  return `UTC+${offset} (${season})`;
}
