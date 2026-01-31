# Admin Panel

A full-stack web application for managing employee absences, built with React, Node.js, TypeScript, Prisma, and PostgreSQL.

## Features

- **Authentication**: Login-based authentication (no registration)
- **User Roles**: Admin and Employee
- **Home Page**: Calendar view of absences with filters
- **Employees Page**: Searchable and filterable employee directory
- **Employee Profile**: Detailed employee information
- **Entitlement Page**: View vacation, sick leave, and day off entitlements
- **Admin Panel**: Approve/reject absence requests and manage users (Stellars Tech)

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
npm run install:all
```

### 2. Environment Configuration

1. Copy the environment example files:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

2. Update `backend/.env` with your configuration:
   - **DATABASE_URL**: Update with your PostgreSQL credentials
     ```bash
     DATABASE_URL="postgresql://user:password@localhost:5432/admin_panel?schema=public"
     ```
   - **JWT_SECRET**: Generate a secure secret key:
     ```bash
     openssl rand -base64 32
     ```
     Then update:
     ```bash
     JWT_SECRET="your-generated-secret-key-here"
     ```
   - **PORT**: Backend server port (default: 3001)
   - **FRONTEND_URL**: Frontend URL for CORS (default: http://localhost:5173)
   - **NODE_ENV**: Set to 'development' for development

3. Update `frontend/.env` if needed:
   - **VITE_API_URL**: Backend API URL (default: http://localhost:3001)
   - **NODE_ENV**: Set to 'development' for development

### 3. Database Setup

1. Create a PostgreSQL database:
```bash
createdb admin_panel
```

2. Fix PostgreSQL permissions (if you encounter "permission denied for schema public" error):
   ```bash
   # Connect to PostgreSQL as superuser (usually postgres)
   psql -U postgres -d admin_panel
   
   # Then run these commands:
   GRANT ALL ON SCHEMA public TO admin;
   GRANT ALL PRIVILEGES ON DATABASE admin_panel TO admin;
   \q
   ```
   
   Or if using PostgreSQL 15+, you may need to:
   ```sql
   GRANT USAGE, CREATE ON SCHEMA public TO admin;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin;
   ```

3. Generate Prisma Client and run migrations:
```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
```

### 4. Seed Database (Optional)

Seed the database with sample data (includes admin and employee users):

```bash
cd backend
npm run seed
```

Alternatively, you can create users manually using Prisma Studio:

```bash
cd backend
npm run prisma:studio
```

### 5. Run the Application

From the root directory:

```bash
npm run dev
```

This will start both the backend (port 3001) and frontend (port 5173) servers.

## Default Login Credentials

You'll need to create an admin user first. You can do this by:

1. Using Prisma Studio to manually add a user, or
2. Using the Admin panel (if you already have an admin account)

To create a user manually, hash a password using bcrypt and insert it into the database.

## Project Structure

```
teamstack/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── server.ts
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── contexts/
│   │   └── main.tsx
│   └── package.json
└── package.json
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login

### Absences
- `GET /api/absences` - Get absences (with filters)
- `POST /api/absences` - Create new absence

### Employees
- `GET /api/employees` - Get all employees (with filters)
- `GET /api/employees/:id` - Get employee details

### Entitlements
- `GET /api/entitlements/me` - Get current user's entitlements

### Admin
- `GET /api/admin/pending-requests` - Get pending absence requests
- `PATCH /api/admin/requests/:id/approve` - Approve request
- `PATCH /api/admin/requests/:id/reject` - Reject request
- `POST /api/admin/users` - Create new user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/projects` - Get all projects

## Development

### Backend Development
```bash
cd backend
npm run dev
```

### Frontend Development
```bash
cd frontend
npm run dev
```

## Production Build

### Build Backend
```bash
cd backend
npm run build
npm start
```

### Build Frontend
```bash
cd frontend
npm run build
```

## License

MIT
