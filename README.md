# Worker Manager

Worker Manager is now a full-stack application with:

- MongoDB-backed worker storage
- Login and signup
- A private admin account configured from environment variables
- Admin user creation and password reset
- PDF and PNG export
- Per-date report selections

## Stack

- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js, Express
- Database: MongoDB Atlas via Mongoose
- Auth: JWT + bcrypt
- Export: jsPDF + autoTable

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template and fill in your MongoDB plus admin credentials:

```bash
cp .env.example .env
```

3. Update `.env` with your real MongoDB Atlas URI and your private admin login.

Use this format:

```env
MONGODB_URI=mongodb+srv://<db_username>:<db_password>@cluster0.nb0xuv3.mongodb.net/worker-manager?retryWrites=true&w=majority&appName=Cluster0
JWT_SECRET=change-this-before-production
ADMIN_NAME=Private Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-this-admin-password
PORT=3000
```

4. Start the server:

```bash
npm start
```

5. Open:

```text
http://localhost:3000
```

## Features

### Authentication

- Login form
- Signup form
- JWT-based authenticated session
- User password change with old-password verification

### Worker Management

- Add, update, delete workers
- Bulk set hours
- Bulk increment hours
- CSV import and export
- JSON backup export
- Initial worker catalog seeded into MongoDB for the configured admin account

### Report Management

- Per-date selected worker list
- Built-in default company logo from the hosted project files, with optional manual override
- PDF export with fixed logo placement
- PDF layout tuned to fit at least 25 rows on one page
- PNG export with fixed logo placement

### Admin Panel

- View all users
- Create users
- Reset any user's password

## Important Notes

- The old browser-only `localforage` storage has been removed.
- Data now lives in MongoDB Atlas.
- There is no local or in-memory database fallback anymore.
- The UI is optimized for mobile usage, including stacked controls and card-style tables on smaller screens.
- The server seeds the workers from the provided overtime sheet into MongoDB for the configured admin account if that account has no workers yet.
- The server will not start until `MONGODB_URI`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` are set with real values.
