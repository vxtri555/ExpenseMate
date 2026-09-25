# ExpenseMate – Personal Expense Management System

A mobile-first, installable web app (PWA) – opens like a real phone app from the home screen, similar to WhatsApp Web / Instagram Lite. Built with **HTML, CSS, JavaScript** (frontend) and **Node.js + Express + MongoDB** (backend).

## Features
- Phone-app UI: app header, bottom navigation, floating + button, bottom-sheet form, category chips
- Installable (PWA): manifest + service worker, own icon, opens full-screen without browser bar, app screens load offline
- Dashboard: total spent, budget left, daily average, top category, recent transactions
- Add / Edit / Delete expenses (title, amount, category, date, payment method, note)
- Charts: category doughnut, daily spending bars, last-6-months bar chart, payment-method pie
- Monthly budget with progress bar, ring meter and over-budget warning
- Smart insights (vs last month, biggest expense, month-end projection)
- Search, category filter, date-range filter, sorting
- Export to CSV
- Dark mode
- Mobile-first; on a laptop it shows as a centered phone-style app
- MongoDB aggregation pipeline for category summary (`/api/summary`)

## Folder structure
```
expensemate/
├── public/          ← frontend
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   ├── manifest.json   ← PWA app info (name, icon, colors)
│   ├── sw.js           ← service worker (install + offline)
│   └── icons/
├── models/          ← MongoDB schemas (Mongoose)
│   ├── Expense.js
│   └── Budget.js
├── server.js        ← Express REST API
├── package.json
└── .env.example
```

## Option A – Quick preview (no database)
Open the folder in VS Code → install the **Live Server** extension → right-click `public/index.html` → **Open with Live Server**.
The app runs in *Offline mode* and saves data in the browser, with sample data preloaded.

## Option A2 – Run with Node, no database yet
`npm install` then `npm start` → open http://localhost:5000.
Without a `.env` (or if Atlas can't be reached) the server still starts, prints an OFFLINE warning, and the app works with browser storage.

## Option B – Full app with MongoDB Atlas (for the hackathon)
1. Install **Node.js** (LTS) from https://nodejs.org
2. Create a free cluster on **MongoDB Atlas** (https://www.mongodb.com/atlas):
   - Database Access → add a user with password
   - Network Access → Add IP → *Allow access from anywhere* (0.0.0.0/0) for the demo
   - Connect → Drivers → copy the connection string
3. In the project folder, copy `.env.example` to `.env` and paste your connection string in `MONGODB_URI`
   (replace `<username>` / `<password>`, keep `/expensemate` as the database name).
4. In the VS Code terminal:
   ```
   npm install
   npm start
   ```
5. Open **http://localhost:5000** – the sidebar shows "● Connected to MongoDB".
   Every expense you add is now stored in the `expenses` collection in Atlas (check it in Atlas → Browse Collections or MongoDB Compass).

## Install it like an app (PWA)
- **Laptop (Chrome/Edge):** open http://localhost:5000 → click the install icon in the address bar (or Reports tab → "Install ExpenseMate app").
- **Phone:** installing needs HTTPS. Easiest: deploy the project free on **Render** (render.com → New Web Service → connect GitHub repo → Build `npm install`, Start `npm start`, add `MONGODB_URI` env variable). Open the https link on your phone → Chrome menu → **Add to Home screen / Install app**.
- Quick phone test without deploy: laptop and phone on the same Wi-Fi → open `http://<your-laptop-IP>:5000` on the phone (works, but the install option may not appear on plain http).

## REST API
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/expenses?month=2026-09&category=Food&search=tea` | List expenses |
| POST | `/api/expenses` | Add expense |
| PUT | `/api/expenses/:id` | Update expense |
| DELETE | `/api/expenses/:id` | Delete expense |
| GET | `/api/expenses/summary?month=2026-09` | Category totals (aggregation pipeline) |
| GET / PUT | `/api/budget/:month` | Get / set monthly budget |
| GET | `/api/health` | Server + DB status |
