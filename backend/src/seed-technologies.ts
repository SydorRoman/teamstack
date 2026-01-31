import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding technologies only...');

  const technologies = [
    'Node.js',
    'React',
    'TypeScript',
    'JavaScript',
    'HTML',
    'CSS',
    'Express.js',
    'Redux Toolkit',
    'React Query',
    'Stripe',
    'Tailwind CSS',
    'Prisma',
    'PostgreSQL',
    'Docker',
    'Kubernetes',
    'AWS - S3',
    'AWS - SQS',
    'AWS - SNS',
    'AWS - Lambda',
    'AWS - ECS',
    'AWS - EKS',
    'AWS - Fargate',
    'AWS - ECR',
    'AWS - EFS',
    'AWS - RDS',
    'AWS - API Gateway',
    'AWS - CloudFront',
    'AWS - CloudWatch',
    'GCP - Cloud Run',
    'GCP - Cloud Functions',
    'GCP - Cloud Storage',
    'GCP - Cloud SQL',
    'GCP - Cloud Spanner',
    'GCP - Cloud Bigtable',
    'GCP - Cloud Bigtable',
    'Azure',
    'Linux',
    'Windows',
    'MacOS',
    'Git',
    'GitHub',
    'GitLab',
    'GitHub Actions',
  ];

  const result = await prisma.technology.createMany({
    data: technologies.map((name) => ({ name })),
    skipDuplicates: true,
  });

  console.log(`Seeded ${result.count} technologies.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
