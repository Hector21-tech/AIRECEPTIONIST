import { Logger } from '../utils/logger.js';
import slugify from 'slugify';

/**
 * KnowledgeGenerator - Genererar knowledge.jsonl per restaurang
 * En rad = ett Q&A objekt för Voice AI
 */
export class KnowledgeGenerator {
  constructor(normalizer) {
    this.normalizer = normalizer;
    this.logger = new Logger('KnowledgeGenerator');
    this.knowledgeItems = [];
  }

  /**
   * Generera stabilt ID för kunskapsobjekt
   */
  generateId(content, type = 'qa') {
    const slug = slugify(content.substring(0, 40), { lower: true, strict: true });
    return `${type}-${slug}`;
  }

  /**
   * Generera Q&A för öppettider
   */
  generateHoursQA(info, location) {
    const qa = [];

    // Allmän öppettiderfråga
    const weekdayHours = Object.entries(info.hours)
      .filter(([day, hours]) => !['saturday', 'sunday'].includes(day) && hours !== 'closed')
      .map(([day, hours]) => {
        const dayNames = {
          'monday': 'måndag', 'tuesday': 'tisdag', 'wednesday': 'onsdag',
          'thursday': 'torsdag', 'friday': 'fredag'
        };
        return `${dayNames[day]} ${hours}`;
      });

    if (weekdayHours.length > 0) {
      qa.push({
        id: this.generateId('öppettider vardagar', 'hours'),
        question: 'Vilka öppettider har ni?',
        answer: `Vi har öppet ${weekdayHours.join(', ')}. Ring oss för helgers öppettider!`,
        source: 'hours_data',
        tags: ['öppettider', 'tider', 'vardag'],
        location: location
      });
    }

    // Helgöppettider
    const weekendHours = Object.entries(info.hours)
      .filter(([day]) => ['saturday', 'sunday'].includes(day))
      .map(([day, hours]) => {
        const dayNames = { 'saturday': 'lördag', 'sunday': 'söndag' };
        return `${dayNames[day]} ${hours === 'closed' ? 'stängt' : hours}`;
      });

    if (weekendHours.length > 0) {
      qa.push({
        id: this.generateId('öppettider helg', 'hours'),
        question: 'Har ni öppet på helger?',
        answer: `På helger: ${weekendHours.join(', ')}.`,
        source: 'hours_data',
        tags: ['öppettider', 'helg', 'lördag', 'söndag'],
        location: location
      });
    }

    // Specialöppettider
    if (info.special_hours && info.special_hours.length > 0) {
      qa.push({
        id: this.generateId('specialöppettider', 'hours'),
        question: 'Har ni avvikande öppettider?',
        answer: 'Vi kan ha avvikande öppettider under helger och speciella dagar. Ring oss för aktuell information!',
        source: 'special_hours',
        tags: ['öppettider', 'avvikande', 'helger'],
        location: location
      });
    }

    return qa;
  }

  /**
   * Generera Q&A för meny och allergier
   */
  generateMenuQA(info, location) {
    const qa = [];

    if (!info.menu || info.menu.length === 0) {
      qa.push({
        id: this.generateId('meny allmän', 'menu'),
        question: 'Vad serverar ni för mat?',
        answer: 'Vi serverar god mat tillagad med kärlek. Ring oss eller besök vår hemsida för aktuell meny!',
        source: 'fallback',
        tags: ['meny', 'mat'],
        location: location
      });
      return qa;
    }

    // Allmän menyfråga
    const categories = [...new Set(info.menu.map(item => item.category))];
    qa.push({
      id: this.generateId('meny allmän', 'menu'),
      question: 'Vad har ni för mat?',
      answer: `Vi serverar ${categories.join(', ')} och mycket mer. Se vår kompletta meny på hemsidan eller ring oss!`,
      source: 'menu_analysis',
      tags: ['meny', 'mat', 'kategorier'],
      location: location
    });

    // Prisfrågor
    const prices = info.menu
      .map(item => item.price)
      .filter(price => price && typeof price === 'number');

    if (prices.length > 0) {
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      qa.push({
        id: this.generateId('priser allmänt', 'price'),
        question: 'Vad kostar era rätter?',
        answer: `Våra priser ligger mellan ${minPrice} kr och ${maxPrice} kr. Kontakta oss för aktuell prislista!`,
        source: 'menu_analysis',
        tags: ['pris', 'kostnad', 'meny'],
        location: location
      });
    }

    // Allergenfrågor
    const allergens = [...new Set(info.menu.flatMap(item => item.allergens || []))];

    // Gluten
    if (allergens.includes('gluten')) {
      qa.push({
        id: this.generateId('gluten allergi', 'allergen'),
        question: 'Har ni glutenfritt?',
        answer: 'Vi arbetar med gluten i vårt kök men kan anpassa många rätter. Säg alltid till om glutenintolerans så hjälper vi dig!',
        source: 'menu_analysis',
        tags: ['allergi', 'gluten', 'anpassning'],
        location: location
      });
    } else {
      qa.push({
        id: this.generateId('gluten info', 'allergen'),
        question: 'Har ni glutenfritt?',
        answer: 'Vi märker vår meny så gott det går. Fråga alltid personalen om glutenfria alternativ när du beställer!',
        source: 'policy',
        tags: ['allergi', 'gluten', 'information'],
        location: location
      });
    }

    // Laktos
    if (allergens.includes('laktos')) {
      qa.push({
        id: this.generateId('laktos allergi', 'allergen'),
        question: 'Har ni laktosfritt?',
        answer: 'Vi arbetar med laktos i vårt kök men kan anpassa många rätter. Säg till personalen så hjälper vi dig välja rätt!',
        source: 'menu_analysis',
        tags: ['allergi', 'laktos', 'anpassning'],
        location: location
      });
    } else {
      qa.push({
        id: this.generateId('laktos info', 'allergen'),
        question: 'Har ni laktosfritt?',
        answer: 'Vi strävar efter att erbjuda laktosfria alternativ. Fråga personalen om dagens laktosfria alternativ!',
        source: 'policy',
        tags: ['allergi', 'laktos', 'information'],
        location: location
      });
    }

    // Vegetariskt/veganskt
    const vegLabels = info.menu.flatMap(item => item.labels || [])
      .filter(label => ['vegetarisk', 'vegan', 'vegansk'].includes(label.toLowerCase()));

    if (vegLabels.length > 0) {
      qa.push({
        id: this.generateId('vegetariskt', 'dietary'),
        question: 'Har ni vegetariska alternativ?',
        answer: 'Ja, vi har alltid vegetariska och ofta även veganska alternativ på menyn. Fråga personalen för dagens utbud!',
        source: 'menu_analysis',
        tags: ['vegetariskt', 'veganskt', 'mat'],
        location: location
      });
    } else {
      qa.push({
        id: this.generateId('vegetariskt allmänt', 'dietary'),
        question: 'Har ni vegetariska alternativ?',
        answer: 'Vi strävar efter att erbjuda vegetariska alternativ. Kontakta oss så berättar vi vad vi kan erbjuda!',
        source: 'policy',
        tags: ['vegetariskt', 'alternativ'],
        location: location
      });
    }

    return qa;
  }

  /**
   * Generera Q&A för bokning och service
   */
  generateBookingQA(info, location) {
    const qa = [];

    // Grundläggande bokning
    qa.push({
      id: this.generateId('boka bord', 'booking'),
      question: 'Kan jag boka bord?',
      answer: `Absolut! Ring oss på ${info.phone} så hjälper vi dig hitta en ledig tid. För hur många gäster?`,
      source: 'booking_policy',
      tags: ['bokning', 'reservation', 'telefon'],
      location: location
    });

    // Bokningsregler
    if (info.booking) {
      const booking = info.booking;

      qa.push({
        id: this.generateId('avbokning policy', 'booking'),
        question: 'Kan jag avboka mitt bord?',
        answer: booking.cancellation_policy,
        source: 'booking_policy',
        tags: ['avbokning', 'policy', 'regler'],
        location: location
      });

      if (booking.max_guests && booking.max_guests > 8) {
        qa.push({
          id: this.generateId('stora grupper', 'booking'),
          question: 'Kan ni ta emot större sällskap?',
          answer: `Vi tar gärna emot grupper upp till ${booking.max_guests} personer. Ring oss i förväg så ordnar vi plats!`,
          source: 'booking_policy',
          tags: ['grupp', 'sällskap', 'event', 'bokning'],
          location: location
        });
      } else {
        qa.push({
          id: this.generateId('stora grupper standard', 'booking'),
          question: 'Kan ni ta emot större sällskap?',
          answer: 'Vi tar gärna emot större grupper. Ring oss i förväg så ordnar vi plats och eventuellt specialmeny!',
          source: 'booking_policy',
          tags: ['grupp', 'sällskap', 'event', 'bokning'],
          location: location
        });
      }
    }

    return qa;
  }

  /**
   * Generera Q&A för kontakt och plats
   */
  generateContactQA(info, location) {
    const qa = [];

    // Telefonnummer
    if (info.phone) {
      qa.push({
        id: this.generateId('telefonnummer', 'contact'),
        question: 'Vad är ert telefonnummer?',
        answer: `Du når oss på ${info.phone}.`,
        source: 'contact_data',
        tags: ['telefon', 'kontakt', 'nummer'],
        location: location
      });
    }

    // Adress
    if (info.address) {
      qa.push({
        id: this.generateId('adress plats', 'contact'),
        question: 'Var ligger ni?',
        answer: `Vi finns på ${info.address}, ${info.city}.`,
        source: 'contact_data',
        tags: ['adress', 'plats', 'hitta'],
        location: location
      });

      qa.push({
        id: this.generateId('parkering', 'contact'),
        question: 'Finns det parkering?',
        answer: 'Vi har parkeringsmöjligheter. Kontakta oss för mer information om parkering vid vår restaurang.',
        source: 'general_info',
        tags: ['parkering', 'bil', 'transport'],
        location: location
      });
    }

    // Email
    if (info.email) {
      qa.push({
        id: this.generateId('email kontakt', 'contact'),
        question: 'Vad är er e-postadress?',
        answer: `Du kan maila oss på ${info.email}.`,
        source: 'contact_data',
        tags: ['email', 'e-post', 'kontakt'],
        location: location
      });
    }

    return qa;
  }

  /**
   * Generera Q&A för betalning och service
   */
  generateServiceQA(info, location) {
    const qa = [];

    // Betalningsmetoder
    qa.push({
      id: this.generateId('betalning metoder', 'service'),
      question: 'Vilka betalningsmetoder tar ni emot?',
      answer: 'Vi tar emot kontanter, kort och Swish. Alla vanliga betalmetoder fungerar bra.',
      source: 'general_policy',
      tags: ['betalning', 'swish', 'kort', 'kontanter'],
      location: location
    });

    // Barnvänlighet
    qa.push({
      id: this.generateId('barn familj', 'service'),
      question: 'Är ni barnvänliga?',
      answer: 'Absolut! Vi välkomnar barn och familjer. Vi har barnstolar och kan anpassa mat för de minsta.',
      source: 'general_policy',
      tags: ['barn', 'familj', 'barnvänlig', 'service'],
      location: location
    });

    // WiFi
    qa.push({
      id: this.generateId('wifi internet', 'service'),
      question: 'Har ni wifi?',
      answer: 'Ja, vi erbjuder fri wifi till våra gäster. Fråga personalen om lösenordet när du kommer!',
      source: 'general_service',
      tags: ['wifi', 'internet', 'service'],
      location: location
    });

    // Takeaway
    qa.push({
      id: this.generateId('takeaway avhämtning', 'service'),
      question: 'Kan jag beställa takeaway?',
      answer: 'Ring oss och fråga vad som är möjligt för den rätt du vill ha! Vi hjälper dig gärna.',
      source: 'general_service',
      tags: ['takeaway', 'avhämtning', 'service'],
      location: location
    });

    return qa;
  }

  /**
   * Generera Q&A från meddelanden
   */
  generateMessagesQA(info, location) {
    const qa = [];

    if (!info.messages || info.messages.length === 0) return qa;

    info.messages.forEach(message => {
      if (message.type === 'special_offer' || message.type === 'promotion') {
        qa.push({
          id: this.generateId(message.title, 'promotion'),
          question: `Har ni några erbjudanden just nu?`,
          answer: `${message.title}: ${message.content}`,
          source: 'current_promotions',
          validity: message.validity,
          tags: ['erbjudande', 'kampanj', 'special'],
          location: location
        });
      } else if (message.type === 'daily_special') {
        qa.push({
          id: this.generateId(message.title, 'daily'),
          question: 'Vad är dagens rätt?',
          answer: `${message.title}: ${message.content}`,
          source: 'daily_menu',
          validity: message.validity,
          tags: ['dagens', 'lunch', 'special'],
          location: location
        });
      }
    });

    return qa;
  }

  /**
   * Generera komplett knowledge base för en restaurang
   */
  generateKnowledge(info, location) {
    this.logger.info(`Generating knowledge base for ${location}`);
    this.knowledgeItems = [];

    // Samla alla Q&A kategorier
    const allQA = [
      ...this.generateHoursQA(info, location),
      ...this.generateMenuQA(info, location),
      ...this.generateBookingQA(info, location),
      ...this.generateContactQA(info, location),
      ...this.generateServiceQA(info, location),
      ...this.generateMessagesQA(info, location)
    ];

    // Konvertera till standardiserat format (q/a för kompatibilitet med original system)
    this.knowledgeItems = allQA.map(qa => ({
      id: qa.id,
      type: 'qa',
      q: qa.question,  // Använd 'q' istället för 'question' för kompatibilitet
      a: qa.answer,    // Använd 'a' istället för 'answer' för kompatibilitet
      source: qa.source,
      validity: qa.validity || { start: new Date().toISOString(), end: null },
      tags: qa.tags || [],
      location: location,
      priority: 'high'  // Lägg till priority för Voice AI
    }));

    this.logger.info(`Generated knowledge base for ${location}`, {
      totalItems: this.knowledgeItems.length,
      categories: [...new Set(this.knowledgeItems.map(item => item.source))]
    });

    return this.knowledgeItems;
  }
}