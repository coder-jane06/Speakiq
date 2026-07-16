"""Screenshot every page of Fluently at desktop + mobile widths for UI analysis."""
from playwright.sync_api import sync_playwright
import os, time

OUT = r"C:\Users\GAMER\.gemini\antigravity\brain\59a7c87b-15cf-4fd3-a191-ea976ae1c6f4"
BASE = "https://localhost:5174/Fluently"

PAGES = [
    ("home",        "/"),
    ("login",       "/login"),
    ("onboarding",  "/onboarding"),
    ("session",     "/session"),
    ("dashboard",   "/dashboard"),
    ("profile",     "/profile"),
]

VIEWPORTS = [
    ("desktop", 1440, 900),
    ("tablet",  1024, 768),
    ("mobile",  390,  844),
]

with sync_playwright() as pw:
    browser = pw.chromium.launch(
        headless=True,
        args=["--ignore-certificate-errors"]
    )

    for vp_name, w, h in VIEWPORTS:
        ctx = browser.new_context(
            viewport={"width": w, "height": h},
            ignore_https_errors=True
        )
        page = ctx.new_page()

        for page_name, path in PAGES:
            print(f"  Capturing {page_name} @ {vp_name} ({w}x{h})...")
            try:
                page.goto(BASE + path, wait_until="networkidle", timeout=20000)
                page.wait_for_timeout(1500)
                fname = os.path.join(OUT, f"ui_{vp_name}_{page_name}.png")
                page.screenshot(path=fname, full_page=True)
                print(f"    Saved: {os.path.basename(fname)}")
            except Exception as e:
                print(f"    ERROR: {e}")

        ctx.close()

    browser.close()

print("\nAll screenshots done.")
