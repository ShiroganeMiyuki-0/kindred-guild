# Kindred Guild - Quest Board Application

A production-ready, Fairy Tail-inspired quest board where users can post quests, accept missions, and earn rewards. Built with React, Supabase (authentication + database), and ready for Stripe payment integration.

## 🚀 Features

### Implemented (Ready for Production)
- ✅ **User Authentication** - Email/password sign up & login via Supabase Auth
- ✅ **Quest Management** - Create, accept, and complete quests
- ✅ **Real-time Database** - All data persists in Supabase PostgreSQL
- ✅ **Row Level Security** - Proper database permissions
- ✅ **Responsive Design** - Works on mobile and desktop
- ✅ **Guild Fee System** - Configurable percentage fee on paid quests
- ✅ **Payment Tracking** - Track payment status for completed quests
- ✅ **Stats Dashboard** - Live metrics on quests and revenue

### Payment System (Free Tier Mode)
- Currently uses confirmation dialogs for payments (no real money)
- Ready for Stripe integration when you're ready to process real payments

## 🛠️ Tech Stack

- **Frontend**: React 18 + Vite
- **Backend**: Supabase (Free Tier)
  - Authentication
  - PostgreSQL Database
  - Row Level Security
- **Styling**: Custom CSS (no framework dependencies)
- **Payments**: Stripe-ready (currently in demo mode)
- **Deployment**: Vercel-ready (free hosting)

## 📦 Quick Start

### Prerequisites
- Node.js 18+ installed
- A free Supabase account ([supabase.com](https://supabase.com))

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Supabase
Follow the detailed instructions in `SUPABASE_SETUP.md`:

1. Create a Supabase project
2. Run the SQL to create the `quests` table
3. Get your API keys
4. Create a `.env` file:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Run Development Server
```bash
npm run dev
```

Visit `http://localhost:3000` to see your app!

### 4. Build for Production
```bash
npm run build
```

Output will be in the `dist/` folder.

## 💰 Monetization

### Revenue Model
- **Guild Fee**: 5-20% on each paid quest (configurable)
- **Example**: $100 quest with 10% fee = $10 guild revenue
- **Free Quests**: No fee, encourages community engagement

### Production Payments
To enable real payments, integrate Stripe (see SUPABASE_SETUP.md for details).

## 🌐 Deployment (Free)

### Deploy to Vercel
1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repo
3. Add environment variables in Vercel dashboard
4. Click Deploy!

## 🆓 Free Tier Limits

### Supabase Free Plan
- 500 MB database (~100k+ quests)
- 50,000 monthly active users
- Unlimited API requests

### Vercel Free Plan
- Unlimited deployments
- 100 GB bandwidth/month
- Automatic SSL

## 📁 Project Structure

```
/workspace
├── src/
│   ├── components/      # React components
│   ├── lib/            # Supabase client
│   ├── App.jsx         # Main app
│   └── styles.css      # Styles
├── dist/               # Production build
├── SUPABASE_SETUP.md   # Setup guide
└── README.md           # This file
```

---

**Built for the Kindred Guild community** | Ready for production deployment!
