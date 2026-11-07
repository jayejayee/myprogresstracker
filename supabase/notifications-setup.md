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

Run `reminders.sql` and `workout-rest-alerts.sql` in the Supabase SQL Editor.
Deploy the updated `send-reminders` function, then run `reminders-cron.sql` to
call the Edge Function once per minute for task and project reminders, and once
per second for workout rest alerts. The once-per-second database job calls the
Edge Function only when a rest alert is due.

After changing `supabase/functions/send-reminders/index.js`, deploy the updated function:

```bash
supabase functions deploy send-reminders
```

If reminders stop arriving, check the `send-reminders` Edge Function logs for push delivery errors, and confirm the `send-reminders-every-minute` job is active in `cron.job`. A local test notification only checks that the browser can display notifications; it does not test scheduled delivery from Supabase.

## 4. Enable a phone

Deploy the website over HTTPS. On iPhone, open it in Safari, use **Share > Add to Home Screen**, launch the installed app, open **Profile**, and tap **Enable phone notifications**. On Android, open the HTTPS site in a supported browser and enable notifications in **Profile**.

Each task and project has a reminder control for a first date/time and a repeat rule: no repeat, daily, weekly, or monthly. The selected device's timezone is stored with the schedule.

## 5. Enable workout rest alerts while the phone is locked

The `workout-rest-alerts.sql` table setup and updated function above are
required for this feature. The table stores the lock-screen alert preference
with the scheduled timer, so the preference remains enabled across app visits.

In the installed app, enable **phone notifications** in Profile, then turn on
**Workout rest timer notifications** in Profile. Rest alerts are checked by a
dedicated once-per-second Supabase Cron job, so Supabase can send the push within
about a second of the scheduled end time. The push provider, network, and device
can still delay actual display. Push services may retain an alert for up to 24
hours if the phone is temporarily offline, but a powered-off phone cannot display
it until it is back on and connected.

After deploying the updated `send-reminders` function, rerun
`workout-rest-alerts.sql` to add the saved preference column, then rerun
`reminders-cron.sql` to update the jobs. This does not change the once-per-minute
task/project reminder schedule.