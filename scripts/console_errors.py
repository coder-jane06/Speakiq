"""Capture all console errors from every page of the Fluently app."""
import asyncio, json
from playwright.async_api import async_playwright

FRONTEND = "https://localhost:5174/Fluently"

PAGES = [
    ("Home",        "/"),
    ("Login",       "/login"),
    ("Onboarding",  "/onboarding"),
    ("Dashboard",   "/dashboard"),
    ("Profile",     "/profile"),
    ("Session",     "/session"),
]

async def capture_errors(page_name, url, page):
    errors   = []
    warnings = []
    network_fails = []

    page.on("pageerror",  lambda e: errors.append(f"[JS EXCEPTION] {e}"))
    page.on("console",    lambda m: (
        errors.append(f"[console.error] {m.text}")   if m.type == "error"   else
        warnings.append(f"[console.warn]  {m.text}") if m.type == "warning" else
        None
    ))
    page.on("requestfailed", lambda req: network_fails.append(
        f"[NET FAIL] {req.method} {req.url[:120]} — {req.failure}"
    ))

    print(f"\n{'='*56}")
    print(f"  PAGE: {page_name} ({url})")
    print(f"{'='*56}")

    try:
        await page.goto(FRONTEND + url,
                        wait_until="networkidle", timeout=18000)
        await page.wait_for_timeout(2000)   # let deferred effects fire
    except Exception as e:
        errors.append(f"[LOAD FAIL] {e}")

    if errors:
        for e in errors:
            print(f"  ERR  {e[:130]}")
    if warnings:
        for w in warnings[:5]:           # cap warnings at 5
            print(f"  WARN {w[:130]}")
    if network_fails:
        for f in network_fails:
            print(f"  NET  {f[:130]}")
    if not errors and not warnings and not network_fails:
        print("  OK   No errors on this page")

    return errors, warnings, network_fails

async def main():
    print("\nFluently Console Error Capture\n")
    all_errors = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=["--ignore-certificate-errors",
                  "--disable-web-security"]
        )
        ctx = await browser.new_context(ignore_https_errors=True)

        for name, path in PAGES:
            page = await ctx.new_page()
            errs, warns, net = await capture_errors(name, path, page)
            all_errors.extend(errs)
            await page.close()

        await browser.close()

    print(f"\n{'='*56}")
    print(f"  TOTAL CONSOLE ERRORS: {len(all_errors)}")
    print(f"{'='*56}\n")

asyncio.run(main())
