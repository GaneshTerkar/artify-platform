# End-to-end payment tests against a local Razorpay stub.
#
# This proves the whole gateway flow offline: create order -> Razorpay order ->
# signed webhook -> order CONFIRMED -> duplicate webhook ignored -> failed
# payment -> browser signature verification -> admin refund -> live-key guard.
#
# It uses a throw-away database (artifyme_paytest) on the portable PostgreSQL
# and a stub Razorpay API. No real keys, network access or money are involved.
#
# Usage (from artifyme-backend):
#   powershell -ExecutionPolicy Bypass -File .\scripts\e2e-payments.ps1
#
# Optional:
#   -PgBin "D:\ArtifyMe\artifyme-portable\runtime\pgsql\bin"

param(
    [string]$PgBin = "D:\ArtifyMe\artifyme-portable\runtime\pgsql\bin",
    [string]$PgHost = "127.0.0.1",
    [int]$PgPort = 55432,
    [string]$PgUser = "postgres",
    [string]$PgPassword = "root",
    [int]$ApiPort = 18081,
    [int]$StubPort = 19999,
    [int]$RedisPort = 15639,
    [string]$RedisExe = "D:\ArtifyMe\artifyme-portable\runtime\redis\redis-server.exe",
    [string]$TestDb = "artifyme_paytest",
    [string]$KeyID = "rzp_test_local",
    [string]$KeySecret = "testsecret",
    [string]$WebhookSecret = "whsec_local_test"
)

$ErrorActionPreference = "Stop"
$script:ApiUrl = "http://127.0.0.1:$ApiPort"
$psql = Join-Path $PgBin "psql.exe"
if (-not (Test-Path $psql)) { throw "psql.exe not found at $psql (pass -PgBin)" }

$root = Split-Path -Parent $PSScriptRoot
$stamp = Get-Date -Format "yyyyMMddHHmmss"
$tmp = Join-Path $env:TEMP "artifyme-paytest-$stamp"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Assert-True($cond, $msg) { if (-not $cond) { throw "ASSERT FAILED: $msg" } }
function Assert-Eq($actual, $expected, $msg) {
    if ($actual -ne $expected) { throw "ASSERT FAILED: $msg (expected '$expected', got '$actual')" }
}

function Get-HmacHex([string]$payload, [string]$secret) {
    $hmac = New-Object System.Security.Cryptography.HMACSHA256
    $hmac.Key = [Text.Encoding]::UTF8.GetBytes($secret)
    $hash = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($payload))
    return (($hash | ForEach-Object { $_.ToString("x2") }) -join "")
}

function Invoke-Api {
    param([string]$Method, [string]$Url, $Body, [string]$Token, [hashtable]$Headers = @{})
    $h = @{}
    foreach ($k in $Headers.Keys) { $h[$k] = $Headers[$k] }
    if ($Token) { $h["Authorization"] = "Bearer $Token" }
    $payload = $null
    if ($null -ne $Body) {
        if ($Body -is [string]) { $payload = $Body } else { $payload = ($Body | ConvertTo-Json -Depth 12 -Compress) }
        $h["Content-Type"] = "application/json"
    }
    try {
        $params = @{
            UseBasicParsing = $true
            Method          = $Method
            Uri             = $Url
            Headers         = $h
            TimeoutSec      = 30
        }
        if ($null -ne $payload) { $params["Body"] = $payload }
        $resp = Invoke-WebRequest @params
        $json = $null
        if ($resp.Content) { try { $json = $resp.Content | ConvertFrom-Json } catch { $json = $resp.Content } }
        return [pscustomobject]@{ Status = [int]$resp.StatusCode; Body = $json; Raw = $resp.Content }
    } catch {
        $status = 0
        $text = $_.Exception.Message
        $response = $_.Exception.Response
        if ($response) {
            $status = [int]$response.StatusCode
            try {
                $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
                $text = $reader.ReadToEnd()
                $reader.Close()
            } catch { }
        }
        $json = $null
        try { $json = $text | ConvertFrom-Json } catch { }
        return [pscustomobject]@{ Status = $status; Body = $json; Raw = $text }
    }
}

function Invoke-Psql([string]$db, [string]$sql) {
    $env:PGPASSWORD = $PgPassword
    $oldEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $out = & $psql -h $PgHost -p $PgPort -U $PgUser -d $db -t -A -c $sql 2>&1
    $code = $LASTEXITCODE
    $ErrorActionPreference = $oldEap
    if ($code -ne 0) { throw "psql failed: $out" }
    return ($out | Where-Object { $_ -notmatch '^NOTICE:' } | Out-String).Trim()
}

function Send-Webhook([string]$eventName, [string]$orderID, [string]$paymentID, [int64]$amountPaise, [string]$eventID) {
    $payload = [ordered]@{
        entity   = "event"
        event    = $eventName
        contains = @("payment")
        payload  = [ordered]@{
            payment = [ordered]@{
                entity = [ordered]@{
                    id                = $paymentID
                    entity            = "payment"
                    amount            = $amountPaise
                    currency          = "INR"
                    status            = "captured"
                    order_id          = $orderID
                    method            = "upi"
                    error_description = "payment failed by test"
                }
            }
        }
    }
    $json = $payload | ConvertTo-Json -Depth 12 -Compress
    $sig = Get-HmacHex $json $WebhookSecret
    return Invoke-Api -Method POST -Url "$script:ApiUrl/webhooks/razorpay" -Body $json -Headers @{
        "X-Razorpay-Signature" = $sig
        "X-Razorpay-Event-Id"  = $eventID
    }
}

function New-TestOrder([string]$token, [string]$suffix) {
    $res = Invoke-Api -Method POST -Url "$script:ApiUrl/api/v1/orders" -Token $token -Headers @{ "Idempotency-Key" = "paytest-order-$suffix" } -Body @{
        painting_category   = "PENCIL"
        size                = "A4"
        persons_included    = "SINGLE"
        reference_image_url = "http://localhost:8080/uploads/paytest.jpg"
        delivery_address    = "Pune, India"
    }
    Assert-Eq $res.Status 201 "create order $suffix"
    return $res.Body.order_id
}

function Start-Checkout([string]$token, [string]$orderID) {
    $res = Invoke-Api -Method POST -Url "$script:ApiUrl/api/v1/orders/$orderID/checkout" -Token $token -Headers @{ "Idempotency-Key" = "paytest-checkout-$orderID" }
    Assert-Eq $res.Status 200 "checkout for order $orderID"
    Assert-Eq $res.Body.provider "razorpay" "checkout provider"
    Assert-True ($res.Body.amount_paise -gt 0) "checkout returns amount in paise"
    Assert-True ($null -ne $res.Body.razorpay_order_id) "checkout returns a razorpay order id"
    return $res.Body
}

$api = $null
$stub = $null
$redis = $null
try {
    Write-Step "Build binaries"
    Push-Location $root
    & go build -o "$tmp\server.exe" ./cmd/server
    if ($LASTEXITCODE -ne 0) { throw "server build failed" }
    & go build -o "$tmp\razorpay-stub.exe" ./cmd/devtools/razorpay-stub
    if ($LASTEXITCODE -ne 0) { throw "stub build failed" }
    Pop-Location

    Write-Step "Create throw-away database $TestDb"
    Invoke-Psql "postgres" "DROP DATABASE IF EXISTS $TestDb" | Out-Null
    Invoke-Psql "postgres" "CREATE DATABASE $TestDb" | Out-Null

    Write-Step "Start Redis, Razorpay stub and API"
    if (-not (Test-Path $RedisExe)) { throw "redis-server.exe not found at $RedisExe (pass -RedisExe)" }
    $redis = Start-Process -FilePath $RedisExe -ArgumentList @(
        "--port", "$RedisPort", "--bind", "127.0.0.1", "--protected-mode", "no",
        "--appendonly", "no", "--dir", "`"$tmp`""
    ) -WindowStyle Hidden -PassThru -RedirectStandardOutput "$tmp\redis.out.log" -RedirectStandardError "$tmp\redis.err.log"
    $redisReady = $false
    for ($i = 0; $i -lt 50; $i++) {
        Start-Sleep -Milliseconds 200
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $tcp.Connect("127.0.0.1", $RedisPort)
            $tcp.Close()
            $redisReady = $true
            break
        } catch { }
    }
    if (-not $redisReady) { throw "redis did not start on port $RedisPort" }

    $env:RAZORPAY_STUB_ADDR = "127.0.0.1:$StubPort"
    $stub = Start-Process -FilePath "$tmp\razorpay-stub.exe" -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput "$tmp\stub.out.log" -RedirectStandardError "$tmp\stub.err.log"
    Start-Sleep -Seconds 1
    Assert-True (-not $stub.HasExited) "razorpay stub is running"

    $env:PORT = "$ApiPort"
    $env:APP_ENV = "test"
    $env:JWT_SECRET = "paytest-jwt-secret"
    $env:DATABASE_URL = "postgres://${PgUser}:${PgPassword}@${PgHost}:${PgPort}/${TestDb}?sslmode=disable"
    $env:MIGRATIONS_PATH = Join-Path $root "cmd\migrations"
    $env:REDIS_ADDR = "127.0.0.1:$RedisPort"
    $env:REDIS_PASSWORD = ""
    $env:KAFKA_ENABLED = "false"
    $env:CORS_ALLOWED_ORIGINS = "*"
    $env:PAYMENT_PROVIDER = "razorpay"
    $env:PAYMENTS_LIVE = "false"
    $env:RAZORPAY_KEY_ID = $KeyID
    $env:RAZORPAY_KEY_SECRET = $KeySecret
    $env:RAZORPAY_WEBHOOK_SECRET = $WebhookSecret
    $env:RAZORPAY_API_BASE = "http://127.0.0.1:$StubPort"

    $api = Start-Process -FilePath "$tmp\server.exe" -WorkingDirectory $root -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput "$tmp\api.out.log" -RedirectStandardError "$tmp\api.err.log"

    $ready = $false
    for ($i = 0; $i -lt 120; $i++) {
        Start-Sleep -Milliseconds 500
        if ($api.HasExited) { break }
        try {
            $h = Invoke-WebRequest -UseBasicParsing -Uri "$script:ApiUrl/health" -TimeoutSec 2
            if ($h.StatusCode -eq 200) { $ready = $true; break }
        } catch { }
    }
    if (-not $ready) {
        Write-Host (Get-Content "$tmp\api.err.log" -ErrorAction SilentlyContinue)
        Write-Host (Get-Content "$tmp\api.out.log" -ErrorAction SilentlyContinue | Select-Object -Last 30)
        throw "API did not become ready"
    }
    Write-Host "API ready at $script:ApiUrl"

    Write-Step "Register and log in a customer"
    $email = "paytest.$stamp@example.com"
    $password = "password123"
    $reg = Invoke-Api -Method POST -Url "$script:ApiUrl/api/v1/auth/register" -Body @{
        full_name    = "Pay Test"
        email        = $email
        password     = $password
        address      = "Pune, India"
        phone_number = "+919000000000"
    }
    Assert-Eq $reg.Status 201 "register"
    $login = Invoke-Api -Method POST -Url "$script:ApiUrl/api/v1/auth/login" -Body @{ email = $email; password = $password }
    Assert-Eq $login.Status 200 "login"
    $userToken = $login.Body.token

    Write-Step "1/8 create order + gateway checkout"
    $order1 = New-TestOrder $userToken "1"
    $checkout1 = Start-Checkout $userToken $order1
    $rzpOrder1 = $checkout1.razorpay_order_id
    $amountPaise = [int64]$checkout1.amount_paise
    $pay1 = "pay_test_$stamp" + "_1"
    Write-Host "order=$order1 razorpay_order=$rzpOrder1 amount_paise=$amountPaise"

    Write-Step "2/8 signed payment.captured webhook confirms the order"
    $hook = Send-Webhook "payment.captured" $rzpOrder1 $pay1 $amountPaise "evt_$stamp`_1"
    Assert-Eq $hook.Status 200 "captured webhook accepted"
    $orderRes = Invoke-Api -Method GET -Url "$script:ApiUrl/api/v1/orders/$order1" -Token $userToken
    Assert-Eq $orderRes.Body.order.status "CONFIRMED" "order confirmed by webhook"
    $row = Invoke-Psql $TestDb "SELECT status || '|' || provider || '|' || COALESCE(provider_payment_id,'') FROM payments WHERE order_id = '$order1'"
    Assert-Eq $row "paid|razorpay|$pay1" "payment row marked paid"

    Write-Step "3/8 duplicate webhook is ignored"
    $dupe = Send-Webhook "payment.captured" $rzpOrder1 $pay1 $amountPaise "evt_$stamp`_1"
    Assert-Eq $dupe.Status 200 "duplicate webhook accepted"
    Assert-True ($dupe.Body.duplicate -eq $true) "duplicate flagged"

    Write-Step "4/8 unsigned/tampered webhook is rejected"
    $bad = Invoke-Api -Method POST -Url "$script:ApiUrl/webhooks/razorpay" -Body '{"event":"payment.captured"}' -Headers @{
        "X-Razorpay-Signature" = "deadbeef"
        "X-Razorpay-Event-Id"  = "evt_$stamp`_bad"
    }
    Assert-Eq $bad.Status 400 "tampered webhook rejected"

    Write-Step "5/8 failed payment leaves the order PLACED"
    $order2 = New-TestOrder $userToken "2"
    $checkout2 = Start-Checkout $userToken $order2
    $pay2 = "pay_test_$stamp" + "_2"
    $failed = Send-Webhook "payment.failed" $checkout2.razorpay_order_id $pay2 0 "evt_$stamp`_2"
    Assert-Eq $failed.Status 200 "failed webhook accepted"
    $order2Res = Invoke-Api -Method GET -Url "$script:ApiUrl/api/v1/orders/$order2" -Token $userToken
    Assert-Eq $order2Res.Body.order.status "PLACED" "failed payment keeps order placed"
    $row2 = Invoke-Psql $TestDb "SELECT status FROM payments WHERE order_id = '$order2'"
    Assert-Eq $row2 "failed" "payment row marked failed"

    Write-Step "6/8 browser signature verification confirms an order"
    $order3 = New-TestOrder $userToken "3"
    $checkout3 = Start-Checkout $userToken $order3
    $rzpOrder3 = $checkout3.razorpay_order_id
    $pay3 = "pay_test_$stamp" + "_3"
    $badSig = Invoke-Api -Method POST -Url "$script:ApiUrl/api/v1/payments/verify" -Token $userToken -Body @{
        razorpay_order_id   = $rzpOrder3
        razorpay_payment_id = $pay3
        razorpay_signature  = "deadbeef"
    }
    Assert-Eq $badSig.Status 400 "bad checkout signature rejected"
    $goodSig = Get-HmacHex "$rzpOrder3|$pay3" $KeySecret
    $verified = Invoke-Api -Method POST -Url "$script:ApiUrl/api/v1/payments/verify" -Token $userToken -Body @{
        razorpay_order_id   = $rzpOrder3
        razorpay_payment_id = $pay3
        razorpay_signature  = $goodSig
    }
    Assert-Eq $verified.Status 200 "good checkout signature accepted"
    Assert-Eq $verified.Body.status "paid" "verify reports paid"
    Assert-Eq $verified.Body.order.status "CONFIRMED" "verify confirms the order"

    Write-Step "7/8 admin refund (stub refund API)"
    Invoke-Psql $TestDb "UPDATE users SET role = 'ADMIN' WHERE email = '$email'" | Out-Null
    $adminLogin = Invoke-Api -Method POST -Url "$script:ApiUrl/api/v1/auth/login" -Body @{ email = $email; password = $password }
    Assert-Eq $adminLogin.Status 200 "admin login"
    $adminToken = $adminLogin.Body.token

    $customerRefund = Invoke-Api -Method POST -Url "$script:ApiUrl/api/v1/admin/orders/$order1/refund" -Token $userToken
    Assert-Eq $customerRefund.Status 403 "customer cannot refund"

    $refund = Invoke-Api -Method POST -Url "$script:ApiUrl/api/v1/admin/orders/$order1/refund" -Token $adminToken
    Assert-Eq $refund.Status 200 "admin refund"
    Assert-Eq $refund.Body.status "refunded" "refund status"
    $row3 = Invoke-Psql $TestDb "SELECT status FROM payments WHERE order_id = '$order1'"
    Assert-Eq $row3 "refunded" "payment row marked refunded"

    Write-Step "8/8 live-key guard refuses to start"
    $env:PAYMENTS_LIVE = "false"
    $env:RAZORPAY_KEY_ID = "rzp_live_fakekey"
    $env:PORT = "$($ApiPort + 1)"
    $guard = Start-Process -FilePath "$tmp\server.exe" -WorkingDirectory $root -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput "$tmp\guard.out.log" -RedirectStandardError "$tmp\guard.err.log"
    $exited = $false
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Milliseconds 250
        if ($guard.HasExited) { $exited = $true; break }
    }
    if (-not $exited) { Stop-Process -Id $guard.Id -Force }
    Assert-True $exited "server exits when a live key is used without PAYMENTS_LIVE"
    $guardLog = Get-Content "$tmp\guard.err.log" -Raw -ErrorAction SilentlyContinue
    if (-not $guardLog) { $guardLog = Get-Content "$tmp\guard.out.log" -Raw -ErrorAction SilentlyContinue }
    Assert-True ($guardLog -match "LIVE key") "guard log explains the refusal"

    Write-Host "`nALL PAYMENT E2E CHECKS PASSED" -ForegroundColor Green
    Write-Host "Logs: $tmp"
} finally {
    if ($api -and -not $api.HasExited) { Stop-Process -Id $api.Id -Force -ErrorAction SilentlyContinue }
    if ($stub -and -not $stub.HasExited) { Stop-Process -Id $stub.Id -Force -ErrorAction SilentlyContinue }
    if ($redis -and -not $redis.HasExited) { Stop-Process -Id $redis.Id -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Milliseconds 500
    try { Invoke-Psql "postgres" "DROP DATABASE IF EXISTS $TestDb" | Out-Null } catch { Write-Host "cleanup: $($_.Exception.Message)" }
    $env:PORT = $null
    $env:PAYMENTS_LIVE = $null
    $env:RAZORPAY_KEY_ID = $null
    $env:PAYMENT_PROVIDER = $null
}
