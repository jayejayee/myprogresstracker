# Push notification setup

Push reminders need an HTTPS deployment, browser permission, VAPID keys, and a scheduled Supabase Edge Function. Never commit the VAPID private key or Supabase service role key.

## 1. Create VAPID keys

Run this locally and keep the private key secret:

```bash
npx web-push generate-vapid-keys
```

Put the public key in the ignored `.env.local` file and restart Next.js:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key
```

Set the private values as Supabase Edge Function secrets from the project folder:

```bash
supabase secrets set VAPID_PUBLIC_KEY=your_public_key VAPID_PRIVATE_KEY=your_private_key VAPID_SUBJECT=mailto:you@example.com
supabase functions deploy send-reminders
```

## 2. Add cron credentials to Supabase Vault

In the Supabase SQL Editor, run these statements with your project URL and service role key. Use the service role key only in Vault; never put it in browser code or `.env.local`:

```sql
select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'supabase_url');
select vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'service_role_key');
```

## 3. Create reminder tables and schedule delivery

Run `reminders.sql` in the Supabase SQL Editor. Then run `reminders-cron.sql` to call the Edge Function once per minute.

After changing `supabase/functions/send-reminders/index.js`, deploy the updated function:

```bash
supabase functions deploy send-reminders
```

If reminders stop arriving, check the `send-reminders` Edge Function logs for push delivery errors, and confirm the `send-reminders-every-minute` job is active in `cron.job`. A local test notification only checks that the browser can display notifications; it does not test scheduled delivery from Supabase.

## 4. Enable a phone

Deploy the website over HTTPS. On iPhone, open it in Safari, use **Share > Add to Home Screen**, launch the installed app, open **Profile**, and tap **Enable phone notifications**. On Android, open the HTTPS site in a supported browser and enable notifications in **Profile**.

Each task and project has a reminder control for a first date/time and a repeat rule: no repeat, daily, weekly, or monthly. The selected device's timezone is stored with the schedule.

## 5. Enable workout rest alerts while the phone is locked

Run `workout-rest-alerts.sql` in the Supabase SQL Editor to create the private
rest-alert schedule table. Deploy the updated `send-reminders` function after
applying the SQL:

```bash
supabase functions deploy send-reminders
```

In the installed app, enable **phone notifications** in Profile, then enable
**lock-screen alerts** on the Stopwatch page. When the stopwatch page is visible,
the browser notification appears as soon as its timer reaches zero. When the page
is hidden or the phone is locked, the existing once-per-minute Supabase cron
sends the push alert, which can arrive up to about one minute later (and may be
delayed by the device or network).