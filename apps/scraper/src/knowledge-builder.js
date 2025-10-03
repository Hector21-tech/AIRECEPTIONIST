import { config } from './config.js';
import fs from 'fs/promises';
import slugify from 'slugify';
import { Logger } from './utils/logger.js';

export class KnowledgeBuilder {
  constructor() {
    this.knowledgeBase = [];
    this.restaurantData = {
      locations: [],
      menus: [],
      hours: [],
      contact: [],
      faqs: [],
      policies: {},
      metadata: {
        lastUpdated: new Date().toISOString(),
        totalEntries: 0
      }
    };
    this.logger = new Logger('KnowledgeBuilder');
  }

  generateId(text, type = 'general') {
    const slug = slugify(text.substring(0, 50), { lower: true, strict: true });
    return `${type}-${slug}`;
  }

  // Skapa Q&A för vanliga kundtjänstfrågor
  generateFAQs(extractedData) {
    const faqs = [];

    // Utökade FAQ:s baserat på vanliga restaurangfrågor
    const commonQuestions = [
      // Allergier och specialkost
      {
        q: "Har ni glutenfritt?",
        a: "Vi märker vår meny så gott det går, men fråga alltid personalen för säkerhets skull. Flera rätter kan anpassas till glutenfritt.",
        tags: ["allergi", "gluten", "mat"],
        priority: "high"
      },
      {
        q: "Har ni laktosfritt?",
        a: "Ja, vi har laktosfria alternativ. Säg till personalen vid beställning så hjälper vi dig välja rätt.",
        tags: ["allergi", "laktos", "mat"],
        priority: "high"
      },
      {
        q: "Har ni vegetariska alternativ?",
        a: "Ja, vi har alltid vegetariska och ofta även veganska alternativ på menyn. Fråga gärna personalen för dagens utbud.",
        tags: ["vegetariskt", "veganskt", "mat"],
        priority: "high"
      },
      {
        q: "Har ni barnmeny?",
        a: "Vi har barnvänliga alternativ och kan anpassa portioner för barn. Fråga gärna personalen!",
        tags: ["barn", "barnmeny", "familj"],
        priority: "medium"
      },

      // Bokning och service
      {
        q: "Kan jag boka bord via telefon?",
        a: "Absolut! Ring oss så hjälper vi dig hitta en ledig tid. För hur många gäster och vilken tid passar dig?",
        tags: ["bokning", "telefon", "service"],
        priority: "high"
      },
      {
        q: "Behöver jag boka bord i förväg?",
        a: "Det rekommenderas, speciellt helger och kvällar. Men vi tar även emot drop-in-gäster om det finns plats.",
        tags: ["bokning", "reservation", "service"],
        priority: "high"
      },
      {
        q: "Kan ni ta emot större sällskap?",
        a: "Ja, vi tar gärna emot större grupper. Ring oss i förväg så ordnar vi plats och eventuellt specialmeny.",
        tags: ["grupp", "sällskap", "event", "bokning"],
        priority: "medium"
      },
      {
        q: "Har ni avbokningsregler?",
        a: "Vi ber om avbokning senast 2 timmar före bokad tid. För större sällskap kan andra regler gälla.",
        tags: ["avbokning", "policy", "service"],
        priority: "medium"
      },

      // Priser och betalning
      {
        q: "Vad kostar det att äta hos er?",
        a: "Våra priser varierar beroende på meny. Lunch från ca 125 kr, à la carte från ca 195 kr. Kolla vår hemsida för aktuella priser.",
        tags: ["pris", "meny", "lunch", "dinner"],
        priority: "high"
      },
      {
        q: "Vilka betalningsmetoder tar ni emot?",
        a: "Vi tar emot kontanter, kort och Swish. Alla vanliga betalmetoder fungerar bra.",
        tags: ["betalning", "swish", "kort", "kontanter"],
        priority: "high"
      },
      {
        q: "Har ni lunch?",
        a: "Ja, vi serverar lunch vardagar. Kolla våra öppettider och dagens lunchtilbud på hemsidan!",
        tags: ["lunch", "vardagar", "öppettider"],
        priority: "high"
      },

      // Öppettider och plats
      {
        q: "Vilka öppettider har ni?",
        a: "Våra öppettider varierar mellan våra restauranger. Ring oss eller kolla hemsidan för exakta tider!",
        tags: ["öppettider", "tider", "information"],
        priority: "high"
      },
      {
        q: "Var ligger restaurangen?",
        a: "Vi finns på två platser - i Ängelholm och Väla centrum. Vilken restaurang gäller din fråga?",
        tags: ["adress", "plats", "location"],
        priority: "high"
      },
      {
        q: "Finns det parkering?",
        a: "Ja, det finns parkering vid båda våra restauranger. Kontakta oss för mer information om parkeringsmöjligheter.",
        tags: ["parkering", "bil", "tillgänglighet"],
        priority: "medium"
      },

      // Meny och mat
      {
        q: "Vilken typ av mat serverar ni?",
        a: "Vi erbjuder modern svensk husmanskost med internationella influenser. Allt tillagas färskt med lokala råvaror när det är möjligt.",
        tags: ["meny", "mat", "kök", "style"],
        priority: "medium"
      },
      {
        q: "Har ni dagens rätt?",
        a: "Ja, vi har oftast en dagens rätt på lunch. Ring oss eller kolla hemsidan för vad som gäller idag!",
        tags: ["dagens", "lunch", "special"],
        priority: "medium"
      },
      {
        q: "Kan ni göra specialanpassningar av mat?",
        a: "Vi gör vårt bästa för att anpassa rätter efter önskemål och allergier. Säg till personalen så löser vi det!",
        tags: ["anpassning", "allergi", "special", "kök"],
        priority: "medium"
      },

      // Service och praktiskt
      {
        q: "Har ni wifi?",
        a: "Ja, vi erbjuder fri wifi till våra gäster. Fråga personalen om lösenordet när du kommer!",
        tags: ["wifi", "internet", "service"],
        priority: "low"
      },
      {
        q: "Är restaurangen barnvänlig?",
        a: "Absolut! Vi välkomnar barn och familjer. Vi har barnstolar och kan anpassa mat för de minsta.",
        tags: ["barn", "familj", "barnvänlig", "service"],
        priority: "medium"
      },
      {
        q: "Har ni takeaway?",
        a: "Det varierar mellan våra restauranger. Ring och fråga vad som är möjligt för den rätt du vill ha!",
        tags: ["takeaway", "avhämtning", "service"],
        priority: "medium"
      },
      {
        q: "Kan ni ordna catering?",
        a: "Vi kan ofta hjälpa till med catering för mindre event. Kontakta oss för att diskutera dina behov!",
        tags: ["catering", "event", "service", "grupp"],
        priority: "low"
      }
    ];

    // Generera FAQ från extraherad data
    this.generateDataBasedFAQs(extractedData, faqs);

    // Kombinera alla FAQ:s
    const allFaqs = [...commonQuestions, ...faqs];

    this.logger.info(`Generated ${allFaqs.length} FAQ entries`, {
      common: commonQuestions.length,
      dataBased: faqs.length
    });

    return allFaqs;
  }

  // Generera FAQ baserat på extraherad data
  generateDataBasedFAQs(extractedData, faqs) {
    // Kontaktinfo
    if (extractedData.contact.length > 0) {
      extractedData.contact.forEach(contactInfo => {
        if (contactInfo.contact.phone) {
          faqs.push({
            q: "Vad är ert telefonnummer?",
            a: `Du når oss på ${contactInfo.contact.phone}.`,
            tags: ["telefon", "kontakt"],
            priority: "high",
            source: "extracted_data"
          });
        }
        if (contactInfo.contact.address) {
          faqs.push({
            q: "Var ligger ni?",
            a: `Vi finns på ${contactInfo.contact.address}.`,
            tags: ["adress", "plats"],
            priority: "high",
            source: "extracted_data"
          });
        }
        if (contactInfo.contact.email) {
          faqs.push({
            q: "Vad är er e-postadress?",
            a: `Du kan maila oss på ${contactInfo.contact.email}.`,
            tags: ["email", "kontakt"],
            priority: "medium",
            source: "extracted_data"
          });
        }
      });
    }

    // Öppettider
    if (extractedData.hours.length > 0) {
      extractedData.hours.forEach(hoursInfo => {
        const formattedHours = this.formatHours(hoursInfo.hours);
        faqs.push({
          q: "När har ni öppet?",
          a: `Våra öppettider är: ${formattedHours}`,
          tags: ["öppettider", "tider"],
          priority: "high",
          source: "extracted_data"
        });
      });
    }

    // Menybaserade FAQ:s
    if (extractedData.menus.length > 0) {
      const menuItems = extractedData.menus.flatMap(menu => menu.items);
      const prices = menuItems.map(item => item.price).filter(price => price);

      if (prices.length > 0) {
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        faqs.push({
          q: "Vad kostar era rätter?",
          a: `Våra priser ligger mellan ${minPrice} kr och ${maxPrice} kr. Kontakta oss för aktuell prislista!`,
          tags: ["pris", "meny", "rätter"],
          priority: "high",
          source: "menu_analysis"
        });
      }

      // Populära rätter (de som förekommer oftast)
      const dishNames = menuItems.map(item => item.title?.toLowerCase()).filter(Boolean);
      const popularDishes = this.findPopularDishes(dishNames);

      if (popularDishes.length > 0) {
        faqs.push({
          q: "Vilka är era populära rätter?",
          a: `Några av våra gästers favoriter är: ${popularDishes.slice(0, 3).join(', ')}.`,
          tags: ["populär", "meny", "rekommendation"],
          priority: "medium",
          source: "menu_analysis"
        });
      }
    }

    // Allergiinformation baserat på menyanalys
    const allergenInfo = this.analyzeAllergens(extractedData);
    if (allergenInfo.length > 0) {
      faqs.push({
        q: "Vilka allergener förekommer i er mat?",
        a: `Vi arbetar med ${allergenInfo.join(', ')} i vårt kök. Säg alltid till om allergier så hjälper vi dig!`,
        tags: ["allergi", "säkerhet", "information"],
        priority: "high",
        source: "content_analysis"
      });
    }
  }

  // Konvertera öppettider till naturligt språk
  formatHours(hoursData) {
    const dayNames = {
      mon: 'Måndag',
      tue: 'Tisdag',
      wed: 'Onsdag',
      thu: 'Torsdag',
      fri: 'Fredag',
      sat: 'Lördag',
      sun: 'Söndag'
    };

    const formatted = Object.entries(hoursData)
      .map(([day, hours]) => `${dayNames[day]} ${hours}`)
      .join(', ');

    return formatted;
  }

  // Skapa Voice AI-vänliga meny-beskrivningar
  formatMenuItems(menuData) {
    return menuData.map(menu => {
      const items = menu.items
        .filter(item => item.title)
        .map(item => {
          let description = `${item.title}`;
          if (item.price) description += ` (${item.price} kr)`;
          if (item.description) description += `: ${item.description}`;
          return description;
        })
        .join('. ');

      return {
        source: menu.source,
        description: items,
        itemCount: menu.items.length
      };
    });
  }

  // Bygg komplett knowledge base
  async buildKnowledgeBase() {
    this.logger.knowledgeBuilding('Starting knowledge base construction');

    try {
      const extractedData = await fs.readFile(config.extractedContentFile, 'utf-8');
      const data = JSON.parse(extractedData);

      // Generera FAQ:s
      const faqs = this.generateFAQs(data);
      this.restaurantData.faqs = faqs;

      // Lägg till FAQ:s i knowledge base
      faqs.forEach(faq => {
        this.knowledgeBase.push({
          id: this.generateId(faq.q, 'faq'),
          type: 'qa',
          q: faq.q,
          a: faq.a,
          tags: faq.tags || [],
          priority: 'high'
        });
      });

      // Öppettider
      if (data.hours.length > 0) {
        data.hours.forEach(hoursInfo => {
          const formattedHours = this.formatHours(hoursInfo.hours);
          this.knowledgeBase.push({
            id: this.generateId('öppettider', 'hours'),
            type: 'fact',
            tags: ['öppettider', 'tider'],
            text: `Öppettider: ${formattedHours}`,
            structured: hoursInfo.hours
          });
        });
        this.restaurantData.hours = data.hours;
      }

      // Menyinformation
      if (data.menus.length > 0) {
        const formattedMenus = this.formatMenuItems(data.menus);
        formattedMenus.forEach((menu, index) => {
          this.knowledgeBase.push({
            id: this.generateId(`menu-${index}`, 'menu'),
            type: 'menu',
            tags: ['meny', 'mat', 'rätter'],
            text: menu.description,
            itemCount: menu.itemCount,
            source: menu.source
          });
        });
        this.restaurantData.menus = data.menus;
      }

      // Kontaktinformation
      if (data.contact.length > 0) {
        data.contact.forEach(contactInfo => {
          if (contactInfo.contact.phone) {
            this.knowledgeBase.push({
              id: this.generateId('telefon', 'contact'),
              type: 'fact',
              tags: ['kontakt', 'telefon'],
              text: `Telefonnummer: ${contactInfo.contact.phone}`,
              structured: { phone: contactInfo.contact.phone }
            });
          }
          if (contactInfo.contact.address) {
            this.knowledgeBase.push({
              id: this.generateId('adress', 'contact'),
              type: 'fact',
              tags: ['kontakt', 'adress', 'plats'],
              text: `Adress: ${contactInfo.contact.address}`,
              structured: { address: contactInfo.contact.address }
            });
          }
        });
        this.restaurantData.contact = data.contact;
      }

      // Allmän innehållsinfo för fallback
      data.content.forEach(page => {
        if (page.mainText && page.mainText.length > 100) {
          const summary = page.mainText.substring(0, 300) + '...';
          this.knowledgeBase.push({
            id: this.generateId(page.title || page.url, 'content'),
            type: 'content',
            tags: [page.category || 'allmän'],
            text: summary,
            title: page.title,
            url: page.url,
            priority: 'low'
          });
        }
      });

      // Lägg till policys
      this.restaurantData.policies = {
        booking: "Vi håller bord i 15 minuter efter bokad tid. För större sällskap, kontakta oss i förväg.",
        allergens: "Vi märker vår meny så gott det går men fråga alltid personalen vid allergier.",
        payment: "Vi tar emot kontanter och kortbetalningar. Swish finns tillgängligt.",
        cancellation: "Avbokningar ska göras senast 2 timmar före bokad tid."
      };

      // Uppdatera metadata
      this.restaurantData.metadata = {
        lastUpdated: new Date().toISOString(),
        totalEntries: this.knowledgeBase.length,
        categories: [...new Set(this.knowledgeBase.map(item => item.type))],
        tags: [...new Set(this.knowledgeBase.flatMap(item => item.tags || []))]
      };

      // Spara knowledge base som JSONL (en JSON per rad för AI-system)
      const jsonlContent = this.knowledgeBase
        .map(item => JSON.stringify(item))
        .join('\n');

      await fs.writeFile(config.knowledgeBasePath, jsonlContent, 'utf-8');

      // Spara även som komplett restaurangdata
      await fs.writeFile(
        config.restaurantDataFile,
        JSON.stringify(this.restaurantData, null, 2),
        'utf-8'
      );

      this.logger.knowledgeComplete({
        knowledgeEntries: this.knowledgeBase.length,
        knowledgeBasePath: config.knowledgeBasePath,
        restaurantDataPath: config.restaurantDataFile,
        categories: this.restaurantData.metadata.categories.length,
        totalTags: this.restaurantData.metadata.tags.length
      });

      return {
        knowledgeBase: this.knowledgeBase,
        restaurantData: this.restaurantData
      };

    } catch (error) {
      this.logger.error('Knowledge base construction failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // Hjälpmetoder för FAQ-generering
  findPopularDishes(dishNames) {
    const frequency = {};
    dishNames.forEach(dish => {
      const cleanDish = dish.replace(/[^a-zåäöA-ZÅÄÖ\s]/g, '').trim();
      if (cleanDish.length > 3) {
        frequency[cleanDish] = (frequency[cleanDish] || 0) + 1;
      }
    });

    return Object.entries(frequency)
      .filter(([dish, count]) => count > 1)
      .sort(([,a], [,b]) => b - a)
      .map(([dish]) => dish);
  }

  analyzeAllergens(extractedData) {
    const allergens = new Set();

    // Analysera all textcontent för allergener
    extractedData.content.forEach(page => {
      if (page.allergens && page.allergens.length > 0) {
        page.allergens.forEach(allergen => allergens.add(allergen));
      }
    });

    return Array.from(allergens);
  }

  // Hjälpmetod för att söka i knowledge base
  async searchKnowledge(query, type = null) {
    const lowerQuery = query.toLowerCase();
    return this.knowledgeBase
      .filter(item => {
        if (type && item.type !== type) return false;

        const matchesText = item.text?.toLowerCase().includes(lowerQuery) ||
                           item.q?.toLowerCase().includes(lowerQuery) ||
                           item.a?.toLowerCase().includes(lowerQuery);

        const matchesTags = item.tags?.some(tag =>
          tag.toLowerCase().includes(lowerQuery)
        );

        return matchesText || matchesTags;
      })
      .sort((a, b) => {
        // Prioritera FAQ:s och facts
        const priorities = { qa: 3, fact: 2, menu: 2, content: 1 };
        return (priorities[b.type] || 0) - (priorities[a.type] || 0);
      });
  }
}