# deploy-functions.ps1
# Run this once to set secrets and deploy both Edge Functions to Supabase.
# Make sure you're logged in: npx supabase login

Write-Host "Setting M-Pesa secrets on Supabase project..." -ForegroundColor Cyan

npx supabase secrets set `
  MPESA_CONSUMER_KEY="UyY4uZDW08L60kfdAAWPC60TULAIg4G3AJZBRDS9BArJt50Z" `
  MPESA_CONSUMER_SECRET="4XVAubV3Xuy0MyaoPxuNzcOEsl6jj4xC2myFTM4CVXBgfrqNGyK4VQXfK7fRMc1f" `
  MPESA_SHORTCODE="174379" `
  MPESA_PASSKEY="bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919" `
  MPESA_CALLBACK_URL="https://oeyghrweqkyncxualpxn.supabase.co/functions/v1/mpesa-callback" `
  MPESA_SANDBOX="true"

Write-Host "Deploying mpesa-stk..." -ForegroundColor Cyan
npx supabase functions deploy mpesa-stk --project-ref oeyghrweqkyncxualpxn

Write-Host "Deploying mpesa-callback..." -ForegroundColor Cyan
npx supabase functions deploy mpesa-callback --project-ref oeyghrweqkyncxualpxn

Write-Host "Done! Both functions deployed with secrets." -ForegroundColor Green
