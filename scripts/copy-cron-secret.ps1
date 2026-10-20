# Generates a random CRON_SECRET and puts it on the clipboard (it is never printed).
# Paste it into Vercel > Settings > Environment Variables > CRON_SECRET.
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$secret = -join ($bytes | ForEach-Object { $_.ToString("x2") })
Set-Clipboard -Value $secret
Write-Host "CRON_SECRET copiado para a area de transferencia (64 caracteres). Cole no Vercel com Ctrl+V."
