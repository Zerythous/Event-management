/* ==========================================================================
   EVENTORA SUPABASE LOCAL CONFIGURATION TEMPLATE
   --------------------------------------------------------------------------
   Setup instructions:
   1. Copy this file to: eventora/scripts/supabase-config.local.js
   2. Replace the placeholder values below with your actual Supabase Project URL
      and Publishable key from Supabase Dashboard -> Project Settings -> API.
   3. NEVER place a service_role key, secret key (sb_secret_...), or database
      password in any frontend file.
   4. eventora/.gitignore ensures scripts/supabase-config.local.js stays untracked.
   ========================================================================== */

window.EVENTORA_SUPABASE_CONFIG = {
  url: 'YOUR_SUPABASE_PROJECT_URL',
  publishableKey: 'YOUR_SUPABASE_PUBLISHABLE_KEY',
  storageBucket: 'eventora-media'
};
