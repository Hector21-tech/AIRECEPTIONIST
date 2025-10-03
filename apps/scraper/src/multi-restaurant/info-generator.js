import { Logger } from '../utils/logger.js';

/**
 * InfoGenerator - Genererar validerad info.json per restaurang
 */
export class InfoGenerator {
  constructor(normalizer) {
    this.normalizer = normalizer;
    this.logger = new Logger('InfoGenerator');
  }

  /**
   * Validera obligatoriska fält
   */
  validateRequiredFields(info) {
    const required = [
      'slug', 'name', 'address', 'city', 'phone', 'email', 'website',
      'timezone', 'updated_at', 'source_urls'
    ];

    const missing = required.filter(field => !info[field]);

    if (missing.length > 0) {
      this.normalizer.errors.push(`Saknar obligatoriska fält: ${missing.join(', ')}`);
      return false;
    }

    return true;
  }

  /**
   * Validera öppettider logik
   */
  validateHours(hours) {
    if (!hours || typeof hours !== 'object') {
      this.normalizer.errors.push('Öppettider saknas eller har fel format');
      return false;
    }

    const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    let validDays = 0;

    for (const day of weekdays) {
      if (!hours[day]) {
        this.normalizer.errors.push(`Öppettider saknas för ${day}`);
        continue;
      }

      if (hours[day] === 'closed') {
        validDays++;
        continue;
      }

      // Validera tidsformat HH:MM–HH:MM
      const timePattern = /^(\d{2}):(\d{2})–(\d{2}):(\d{2})$/;
      const match = hours[day].match(timePattern);

      if (!match) {
        this.normalizer.errors.push(`Ogiltigt tidsformat för ${day}: ${hours[day]}`);
        continue;
      }

      const [, startHour, startMin, endHour, endMin] = match;
      const startTime = parseInt(startHour) * 60 + parseInt(startMin);
      const endTime = parseInt(endHour) * 60 + parseInt(endMin);

      if (startTime >= endTime) {
        this.normalizer.errors.push(`Sluttid måste vara efter starttid för ${day}: ${hours[day]}`);
        continue;
      }

      validDays++;
    }

    return validDays === weekdays.length;
  }

  /**
   * Validera menystruktur
   */
  validateMenu(menu) {
    if (!Array.isArray(menu)) {
      this.normalizer.errors.push('Meny måste vara en array');
      return false;
    }

    let validItems = 0;

    for (const [index, item] of menu.entries()) {
      if (!item.title) {
        this.normalizer.errors.push(`Menypost ${index}: titel saknas`);
        continue;
      }

      if (item.price && (typeof item.price !== 'object' || typeof item.price.amount !== 'number')) {
        this.normalizer.errors.push(`Menypost ${index}: ogiltigt prisformat`);
        continue;
      }

      if (item.allergens && !Array.isArray(item.allergens)) {
        this.normalizer.errors.push(`Menypost ${index}: allergener måste vara en array`);
        continue;
      }

      validItems++;
    }

    return validItems > 0;
  }

  /**
   * Normalisera menypost
   */
  normalizeMenuItem(item, index) {
    const normalized = {
      title: item.title ? String(item.title).trim() : null,
      description: item.description ? String(item.description).trim() : null,
      category: item.category || 'allmän',
      allergens: this.normalizer.normalizeAllergens(item.allergens || []),
      labels: Array.isArray(item.labels) ? item.labels : []
    };

    // Normalisera pris
    if (item.price !== undefined && item.price !== null) {
      const price = this.normalizer.normalizePrice(item.price);
      if (price) {
        normalized.price = price.amount;
        normalized.currency = price.currency;
        if (price.approximate) {
          normalized.approximate = true;
          this.normalizer.assumptions.push(`Menypost ${index}: approximativt pris`);
        }
      }
    }

    return normalized;
  }

  /**
   * Normalisera bokningsregler
   */
  normalizeBookingRules(booking) {
    if (!booking) {
      // Standard bokningsregler om ingen data finns
      this.normalizer.assumptions.push('Använde standard bokningsregler');
      return {
        min_guests: 1,
        max_guests: 8,
        lead_time_minutes: 120,
        dining_duration_minutes: 120,
        group_overflow_rule: 'manual',
        cancellation_policy: 'Avbokning senast 2 timmar före bokad tid'
      };
    }

    return {
      min_guests: parseInt(booking.min_guests) || 1,
      max_guests: parseInt(booking.max_guests) || 8,
      lead_time_minutes: parseInt(booking.lead_time_minutes) || 120,
      dining_duration_minutes: parseInt(booking.dining_duration_minutes) || 120,
      group_overflow_rule: booking.group_overflow_rule || 'manual',
      cancellation_policy: booking.cancellation_policy || 'Kontakta restaurangen för avbokning'
    };
  }

  /**
   * Normalisera meddelanden (kampanjer, dagens, etc.)
   */
  normalizeMessages(messages) {
    if (!Array.isArray(messages)) return [];

    return messages
      .map(msg => ({
        id: msg.id || `msg-${Date.now()}`,
        type: msg.type || 'announcement',
        title: msg.title || '',
        content: msg.content || '',
        validity: {
          start: this.normalizer.normalizeDate(msg.validity?.start),
          end: msg.validity?.end ? this.normalizer.normalizeDate(msg.validity.end) : null
        },
        priority: msg.priority || 'medium'
      }))
      .filter(msg => msg.title && msg.content);
  }

  /**
   * Generera komplett info.json struktur
   */
  generateInfo(rawData, restaurantSlug) {
    this.logger.info(`Generating info.json for ${restaurantSlug}`);

    // Extrahera grunddata
    const name = rawData.name || rawData.title || 'Okänd Restaurang';
    const city = rawData.city || rawData.location?.city || 'Okänd Stad';
    const brand = rawData.brand || null;

    const info = {
      // Bas-information
      slug: restaurantSlug,
      name: name,
      brand: brand,
      address: rawData.address || rawData.contact?.address || null,
      city: city,
      phone: this.normalizer.normalizePhone(rawData.phone || rawData.contact?.phone),
      email: this.normalizer.validateEmail(rawData.email || rawData.contact?.email),
      website: rawData.website || rawData.url || null,
      timezone: this.normalizer.config.timezone,
      updated_at: this.normalizer.normalizeDate(),
      source_urls: Array.isArray(rawData.source_urls) ? rawData.source_urls : [rawData.url].filter(Boolean),

      // Öppettider
      hours: this.normalizer.normalizeHours(rawData.hours),

      // Avvikande öppettider (helger etc.)
      special_hours: rawData.special_hours ?
        rawData.special_hours.map(special => ({
          date: this.normalizer.normalizeDate(special.date),
          hours: special.hours === 'closed' ? 'closed' :
                 special.hours.includes('-') ?
                 special.hours.split('-').map(t => this.normalizer.normalizeTime(t.trim())).join('–') :
                 'closed',
          reason: special.reason || 'Specialöppettider'
        })) : [],

      // Meny
      menu: [],

      // Bokningsregler
      booking: this.normalizeBookingRules(rawData.booking),

      // Meddelanden
      messages: this.normalizeMessages(rawData.messages || [])
    };

    // Normalisera meny
    if (rawData.menu && Array.isArray(rawData.menu)) {
      info.menu = rawData.menu
        .map((item, index) => this.normalizeMenuItem(item, index))
        .filter(item => item.title);
    } else if (rawData.menuItems && Array.isArray(rawData.menuItems)) {
      info.menu = rawData.menuItems
        .map((item, index) => this.normalizeMenuItem(item, index))
        .filter(item => item.title);
    }

    // Språkstöd (om tillgängligt)
    if (rawData.translations) {
      info.translations = {};
      if (rawData.translations.en) {
        info.translations.en = {
          name: rawData.translations.en.name || name,
          description: rawData.translations.en.description || null,
          address: rawData.translations.en.address || info.address
        };
      }
    }

    // Validering
    const isValid = this.validateRequiredFields(info) &&
                   this.validateHours(info.hours) &&
                   this.validateMenu(info.menu);

    if (!isValid) {
      this.normalizer.errors.push('Validering misslyckades för info.json');
    } else {
      this.normalizer.fixes.push('info.json struktur validerad och normaliserad');
    }

    this.logger.info(`Generated info.json for ${restaurantSlug}`, {
      menuItems: info.menu.length,
      specialHours: info.special_hours.length,
      messages: info.messages.length,
      hasTranslations: !!info.translations,
      valid: isValid
    });

    return info;
  }
}