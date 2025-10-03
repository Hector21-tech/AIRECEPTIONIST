import { db } from './drizzle';
import { users, teams, teamMembers, customers, usage, callLogs, integrations } from './schema';
import { hashPassword } from '@/lib/auth/session';

async function seedAIReceptionistData() {
  console.log('Creating AI Receptionist demo data...');

  // Create Torstens Ängelholm as the first customer
  const [torstenCustomer] = await db
    .insert(customers)
    .values({
      name: 'Torstens Ängelholm',
      contactName: 'Torsten Andersson',
      contactPhone: '+46123456789',
      contactEmail: 'torsten@torstens.se',
      twilioNumber: '+46870123456',
      planType: 'Standard (5 kr/min + 5000 kr uppstart)',
    })
    .returning();

  console.log('Torsten customer created with ID:', torstenCustomer.id);

  // Add some integrations for Torsten
  await db.insert(integrations).values([
    {
      customerId: torstenCustomer.id,
      type: 'booking',
      method: 'Puppeteer',
      status: 'active',
      config: JSON.stringify({
        url: 'bordsbokaren.se',
        fallback: 'SMS till personal'
      }),
    },
    {
      customerId: torstenCustomer.id,
      type: 'pos',
      method: 'SMS',
      status: 'active',
      config: JSON.stringify({
        fallback_phone: '+46123456789',
        fallback_email: 'beställningar@torstens.se'
      }),
    },
  ]);

  // Add usage data for current month
  const currentDate = new Date();
  const currentMonth = currentDate.toISOString().split('T')[0].substring(0, 7); // YYYY-MM

  // Add daily usage for the last 15 days
  for (let i = 1; i <= 15; i++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
    const minutesUsed = Math.random() * 45 + 15; // 15-60 minutes random
    const cost = minutesUsed * 3.5; // 3.5 kr per minute cost
    const revenue = minutesUsed * 5; // 5 kr per minute revenue
    const margin = revenue - cost;

    await db.insert(usage).values({
      customerId: torstenCustomer.id,
      date: date.toISOString().split('T')[0],
      minutesUsed: minutesUsed.toFixed(2),
      cost: cost.toFixed(2),
      revenue: revenue.toFixed(2),
      margin: margin.toFixed(2),
    });
  }

  // Add some call logs
  const sampleTranscripts = [
    'Kund ringde för att boka bord för 4 personer på fredag kväll kl 19:00. Bokade via Bordsbokaren.se automatiskt.',
    'Kund ville beställa take-away pizza. Skickade beställning via SMS till köket: 1x Margherita, 1x Vesuvio.',
    'Kund frågade om öppettider helger. Svarade att vi har öppet 16-22 alla helgdagar utom midsommar.',
    'Kund ville avboka reservation för imorgon. Kunde inte hitta bokningen i systemet, skickade SMS till personal.',
    'Kund beställde catering för 20 personer. För stort för automationen, vidarebefordrade till chef via e-post.',
  ];

  const outcomes = ['success', 'success', 'success', 'fallback', 'fallback'];

  for (let i = 0; i < 5; i++) {
    const callDate = new Date();
    callDate.setDate(callDate.getDate() - i - 1);

    const duration = Math.random() * 8 + 2; // 2-10 minutes
    const cost = duration * (3.5 / 60); // Cost per minute converted from hourly rate

    await db.insert(callLogs).values({
      customerId: torstenCustomer.id,
      datetime: callDate,
      transcript: sampleTranscripts[i],
      outcome: outcomes[i],
      duration: duration.toFixed(2),
      cost: cost.toFixed(2),
    });
  }

  console.log('AI Receptionist demo data created successfully!');
}

async function seed() {
  const email = 'test@test.com';
  const password = 'admin123';
  const passwordHash = await hashPassword(password);

  const [user] = await db
    .insert(users)
    .values([
      {
        email: email,
        passwordHash: passwordHash,
        role: "owner",
      },
    ])
    .returning();

  console.log('Initial user created.');

  const [team] = await db
    .insert(teams)
    .values({
      name: 'Test Team',
    })
    .returning();

  await db.insert(teamMembers).values({
    teamId: team.id,
    userId: user.id,
    role: 'owner',
  });

  await seedAIReceptionistData();
}

seed()
  .catch((error) => {
    console.error('Seed process failed:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('Seed process finished. Exiting...');
    process.exit(0);
  });
