import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const adminPassword = await bcrypt.hash('admin1234', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@smsbulk.app' },
    update: {},
    create: { name: 'Admin', email: 'admin@smsbulk.app', password: adminPassword, role: 'ADMIN' },
  });
  console.log(`✅ Admin: ${admin.email}`);

  const userPassword = await bcrypt.hash('demo1234', 12);
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@smsbulk.app' },
    update: {},
    create: { name: 'Demo User', email: 'demo@smsbulk.app', password: userPassword, role: 'USER' },
  });
  console.log(`✅ Demo: ${demoUser.email}`);

  const vipGroup = await prisma.group.upsert({
    where: { name: 'VIP' }, update: {},
    create: { name: 'VIP', description: 'Clients premium', color: '#F59E0B' },
  });
  const newsletterGroup = await prisma.group.upsert({
    where: { name: 'Newsletter' }, update: {},
    create: { name: 'Newsletter', description: 'Abonnés newsletter', color: '#3B82F6' },
  });
  const promoGroup = await prisma.group.upsert({
    where: { name: 'Promotions' }, update: {},
    create: { name: 'Promotions', description: 'Clients promo', color: '#10B981' },
  });
  console.log('✅ 3 groups created');

  const clientsData = [
    { firstName: 'Amadou',   lastName: 'Diallo', phone: '+221771000001', email: 'amadou@example.com',   tags: ['vip'] },
    { firstName: 'Fatou',    lastName: 'Ndiaye', phone: '+221771000002', email: 'fatou@example.com',    tags: ['newsletter'] },
    { firstName: 'Moussa',   lastName: 'Sarr',   phone: '+221771000003', email: null,                   tags: ['promo'] },
    { firstName: 'Aissatou', lastName: 'Ba',     phone: '+221771000004', email: 'aissatou@example.com', tags: ['vip', 'newsletter'] },
    { firstName: 'Ibrahima', lastName: 'Fall',   phone: '+221771000005', email: null,                   tags: [] },
    { firstName: 'Mariama',  lastName: 'Sy',     phone: '+221771000006', email: 'mariama@example.com',  tags: ['newsletter'] },
    { firstName: 'Ousmane',  lastName: 'Cisse',  phone: '+221771000007', email: null,                   tags: ['promo'] },
    { firstName: 'Rokhaya',  lastName: 'Gaye',   phone: '+221771000008', email: 'rokhaya@example.com',  tags: ['vip'] },
    { firstName: 'Cheikh',   lastName: 'Mbaye',  phone: '+221771000009', email: null,                   tags: ['newsletter', 'promo'] },
    { firstName: 'Ndeye',    lastName: 'Diouf',  phone: '+221771000010', email: 'ndeye@example.com',    tags: [] },
  ];

  for (const c of clientsData) {
    const client = await prisma.client.upsert({
      where: { phone: c.phone },
      update: {},
      create: {
        firstName: c.firstName, lastName: c.lastName,
        phone: c.phone, tags: c.tags,
        ...(c.email ? { email: c.email } : {}),
      },
    });
    for (const tag of c.tags) {
      const groupMap: Record<string, string> = {
        vip: vipGroup.id, newsletter: newsletterGroup.id, promo: promoGroup.id,
      };
      if (groupMap[tag]) {
        await prisma.clientGroup.upsert({
          where: { clientId_groupId: { clientId: client.id, groupId: groupMap[tag] } },
          update: {},
          create: { clientId: client.id, groupId: groupMap[tag] },
        });
      }
    }
  }
  console.log(`✅ ${clientsData.length} clients seeded`);

  await prisma.smsCampaign.create({
    data: {
      name: 'Campagne de bienvenue',
      message: 'Bonjour! Bienvenue chez nous. Profitez de -10% sur votre prochaine commande.',
      status: 'COMPLETED',
      totalCount: 8, sentCount: 7, failedCount: 1,
      userId: demoUser.id, groupId: newsletterGroup.id,
      startedAt: new Date(Date.now() - 86400000),
      completedAt: new Date(Date.now() - 86000000),
    },
  });
  console.log('✅ Sample campaign created');

  console.log('\n🎉 Seed done!');
  console.log('📧 admin@smsbulk.app  / admin1234');
  console.log('📧 demo@smsbulk.app   / demo1234');
}

main()
  .catch((e) => { console.error('❌ Seed error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
