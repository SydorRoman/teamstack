import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const prismaAny = prisma as typeof prisma & { settings: any };

async function main() {
  console.log('Seeding database...');

  // Ensure settings exist
  await prismaAny.settings.upsert({
    where: { id: 'global' },
    update: {},
    create: {
      id: 'global',
      vacationFutureAccrueDays: 1.5,
      sickLeaveFutureAccrueDays: 1.2,
    },
  });

  // Check if projects already exist
  let project1 = await prisma.project.findFirst({ where: { name: 'Web Development' } });

  // Create projects if they don't exist
  if (!project1) {
    project1 = await prisma.project.create({
      data: {
        name: 'Web Development',
      },
    });
  }

  console.log('Created/found projects:', { project1 });

  // Hash password
  const passwordHash = await bcrypt.hash('password123', 10);

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
      passwordHash,
      isAdmin: true,
      gender: 'Male',
      city: 'New York',
      country: 'USA',
      projects: {
        connect: [{ id: project1.id }],
      },
    },
  });

  // Create entitlements for admin
  await prisma.entitlement.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      vacationDays: 25,
      sickLeaveDays: 10,
      dayOffDays: 5,
    },
  });

  // Create employee user
  const employee = await prisma.user.upsert({
    where: { email: 'employee@example.com' },
    update: {},
    create: {
      email: 'employee@example.com',
      firstName: 'John',
      lastName: 'Doe',
      passwordHash,
      isAdmin: false,
      gender: 'Male',
      city: 'San Francisco',
      country: 'USA',
      phone: '+1234567890',
      telegram: '@johndoe',
      birthDate: new Date('1990-01-15'),
      projects: {
        connect: [{ id: project1.id }],
      },
    },
  });

  // Create entitlements for employee
  await prisma.entitlement.upsert({
    where: { userId: employee.id },
    update: {},
    create: {
      userId: employee.id,
      vacationDays: 20,
      sickLeaveDays: 10,
      dayOffDays: 5,
    },
  });


  console.log('Created/found users:', { admin, employee });

  // Create sample work logs
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Create work logs for employee (current month)
  for (let day = 1; day <= 15; day++) {
    const date = new Date(currentYear, currentMonth, day);
    
    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    
    // Skip future dates
    if (date > today) continue;

    const start = new Date(date);
    start.setHours(9, 0, 0, 0);

    const end = new Date(date);
    end.setHours(17, 30, 0, 0);

    await prisma.workLog.upsert({
      where: { id: `worklog-${employee.id}-${day}` },
      update: {},
      create: {
        id: `worklog-${employee.id}-${day}`,
        userId: employee.id,
        date: date,
        start: start,
        end: end,
        projectId: project1.id,
        note: `Worked on ${project1.name}`,
      },
    });
  }

  // Create some work logs for admin too
  for (let day = 1; day <= 10; day++) {
    const date = new Date(currentYear, currentMonth, day);
    
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    if (date > today) continue;

    const start = new Date(date);
    start.setHours(8, 30, 0, 0);

    const end = new Date(date);
    end.setHours(18, 0, 0, 0);

    await prisma.workLog.upsert({
      where: { id: `worklog-${admin.id}-${day}` },
      update: {},
      create: {
        id: `worklog-${admin.id}-${day}`,
        userId: admin.id,
        date: date,
        start: start,
        end: end,
        projectId: project1.id,
        note: `Administrative work`,
      },
    });
  }

  console.log('Created sample work logs');

  console.log('Seed completed successfully!');
  console.log('\nLogin credentials:');
  console.log('Admin: admin@example.com / password123');
  console.log('Employee: employee@example.com / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
