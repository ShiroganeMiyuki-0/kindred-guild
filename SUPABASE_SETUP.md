# Supabase Setup Instructions

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up for a free account
2. Click "New Project"
3. Fill in:
   - Project name: `kindred-guild`
   - Database password: (choose a strong password, save it!)
   - Region: Choose closest to your users
4. Wait for project to be created (2-3 minutes)

## 2. Set Up Authentication

1. In your Supabase dashboard, go to **Authentication** → **Providers**
2. Enable **Email** provider (it's enabled by default)
3. For production, you'll want to configure email templates under **Authentication** → **Email Templates**

## 3. Create the Database Table

Go to **SQL Editor** in Supabase and run this SQL:

```sql
-- Create quests table
CREATE TABLE quests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reward INTEGER DEFAULT 0,
  fee INTEGER DEFAULT 10,
  status TEXT DEFAULT 'pending',
  creator_id UUID REFERENCES auth.users(id),
  accepted_by UUID REFERENCES auth.users(id),
  payment_status TEXT DEFAULT 'unpaid',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE quests ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read quests
CREATE POLICY "Anyone can view quests" ON quests
  FOR SELECT USING (true);

-- Allow authenticated users to create quests
CREATE POLICY "Authenticated users can create quests" ON quests
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow quest creator or acceptor to update their quests
CREATE POLICY "Users can update their quests" ON quests
  FOR UPDATE USING (
    auth.uid() = creator_id OR 
    auth.uid() = accepted_by
  );

-- Create index for performance
CREATE INDEX idx_quests_status ON quests(status);
CREATE INDEX idx_quests_created_at ON quests(created_at DESC);
```

## 4. Get Your API Keys

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

## 5. Configure Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Important:** Never commit this file to Git! It's already in .gitignore.

## 6. Test the Setup

1. Run `npm run dev` to start the development server
2. Try signing up with an email
3. Check your email for the confirmation link
4. After confirming, try creating a quest!

## Free Tier Limits (Supabase)

- **500 MB database** - Enough for thousands of quests
- **50,000 monthly active users** - More than enough for starting
- **Unlimited API requests** - Perfect for our use case

## Next Steps for Production

### Stripe Integration (for real payments)
1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Get your publishable key
3. Add backend function for creating checkout sessions
4. Set up webhook for payment confirmation

### Deployment on Vercel (Free)
1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Legal Documents
Create these pages:
- Terms of Service
- Privacy Policy  
- Refund Policy

---

**Need help?** Check Supabase docs: https://supabase.com/docs
