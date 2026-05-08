# Task 3 Setup Guide

## Database Setup

After running migrations with `pnpm db:push`, you need to create at least one user to bootstrap the system.

### Create Bootstrap Manager User

Run one of the following to create an initial manager account:

**Option 0: Using Seed file**
```bash

pnpm db:seed

Seeding database...
Created admin user: admin@example.com
Created customer: Demo Customer
Created site: Demo Site
Created gauge: Gauge #001
Seeding complete!

Test credentials:
Email: admin@example.com
Password: admin123

```


**Option 1: Using Prisma Studio**

```bash
pnpm db:studio
```

Then manually create a user record with:
- name: "Admin"
- email: "admin@example.com"
- passwordHash: (use the bcrypt hash of your password)
- role: "manager"

**Option 2: Create users via the Node REPL**

```bash
node
> const { hash } = require('bcryptjs');
> const pwd = await hash('password123', 12);
> console.log(pwd); // Copy this hash
```

Then insert into the database:

```sql
INSERT INTO users (id, name, email, passwordHash, role, createdAt)
VALUES (UUID(), 'Admin', 'admin@example.com', '<paste-bcrypt-hash-here>', 'manager', NOW());
```

## Testing the Flow

1. Start the dev server: `pnpm dev`
2. Navigate to `http://localhost:3000`
3. Middleware redirects to `/login`
4. Login with your bootstrap admin credentials
5. Redirected to `/manager/readings`
6. Create a Customer, Site, and Gauge from the manager UI
7. Create a technician user
8. Assign the technician to a gauge
9. Logout and login as the technician
10. Visit `/gauges` to see assigned gauges
11. Click "Foto aufnehmen" to create a reading
12. Upload a photo, and the reading will have the `gaugeId` set

## Key Changes in Task 3

- **Auth**: Auth.js v5 Credentials provider replaces stub
- **Middleware**: Route protection and role-based redirects
- **Database**: User, Customer, Site, Gauge, TechnicianGauge models
- **Technician flow**: Gauge list → capture → readings (filtered by user)
- **Manager flow**: User/Customer/Site/Gauge management → readings review
- **Reading scoping**: Readings now filtered by `technicianId` for technicians

## Files Created/Modified

### New files
- `auth.ts` - Auth.js configuration
- `middleware.ts` - Route protection
- `app/(auth)/login/page.tsx` - Login page
- `app/(auth)/layout.tsx` - Auth layout
- `app/(technician)/gauges/page.tsx` - Gauge list
- `components/LoginForm.tsx` - Login form
- `components/manager/CreateUserForm.tsx` - Create user form
- `app/api/auth/[...nextauth]/route.ts` - Auth API
- `app/api/users/route.ts`, `.../[id]/route.ts` - User API
- `app/api/customers/route.ts` - Customer API
- `app/api/sites/route.ts` - Sites API
- `app/api/gauges/route.ts`, `.../[id]/assignments/route.ts` - Gauges API
- Manager pages: users, customers, sites, gauges

### Modified files
- `prisma/schema.prisma` - Added models and relations
- `lib/auth.ts` - Real Auth.js implementation
- `lib/dto.ts` - Added DTOs for new models
- `lib/validation.ts` - Added validation schemas
- `app/page.tsx` - Role-based redirects
- `messages/de.json` - New i18n keys
- `components/Providers.tsx` - Added SessionProvider
- `.env.example` - Added AUTH_SECRET

## Notes

- Password hashing uses bcryptjs with 12 salt rounds
- JWT sessions (no database sessions table needed)
- Role-based access control in all routes and pages
- Readings linked to both technician and gauge
- Site notes now available when gauge is assigned
