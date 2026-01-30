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
      sickLeaveWithoutCertificateLimit: 5,
      sickLeaveWithCertificateLimit: 5,
      vacationCarryoverLimit: 0,
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
