"""Responsive and asset checks for the already running local website."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

OUTPUT = Path(__file__).resolve().parent
report = {"viewports": [], "page_errors": [], "http_errors": []}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000}, reduced_motion="reduce")
    page.on("pageerror", lambda error: report["page_errors"].append(str(error)))
    page.on("response", lambda response: report["http_errors"].append({"url": response.url, "status": response.status}) if response.status >= 400 else None)
    page.goto("http://localhost:3000", wait_until="networkidle")
    page.evaluate("document.fonts.ready")
    for width, height in [(320, 740), (390, 844), (700, 900), (768, 1024), (1024, 900), (1440, 1000), (1920, 1080)]:
        page.set_viewport_size({"width": width, "height": height})
        page.evaluate("window.scrollTo(0, 0)")
        result = page.evaluate("""() => ({width: innerWidth, actual: document.documentElement.scrollWidth, overflow: document.documentElement.scrollWidth > innerWidth})""")
        report["viewports"].append(result)
        if width in (390, 1440):
            page.screenshot(path=str(OUTPUT / f"viewport-{width}.png"))
            page.screenshot(path=str(OUTPUT / f"page-{width}.png"), full_page=True)

    page.set_viewport_size({"width": 1440, "height": 1000})
    page.locator("[data-education]").click()
    page.wait_for_function("[...document.querySelectorAll('#education-grid img')].every(i => i.complete && i.naturalWidth > 0)")
    page.screenshot(path=str(OUTPUT / "education.png"))
    page.keyboard.press("Escape")
    # Load all lazy main-page images before checking them.
    for image in page.locator("main img").all():
        image.scroll_into_view_if_needed()
    page.wait_for_function("[...document.querySelectorAll('main img')].every(i => i.complete && i.naturalWidth > 0)")
    report["main_images_loaded"] = page.locator("main img").count()
    report["missing_anchor_targets"] = page.evaluate("""() => [...document.querySelectorAll('a[href^="#"]')].map(a=>a.getAttribute('href')).filter(h=>h.length>1&&!document.getElementById(h.slice(1)))""")
    report["privacy_safe_root"] = page.request.get("http://localhost:3000/.env").status == 404
    browser.close()

(OUTPUT / "visual-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=True, indent=2))
assert not report["page_errors"]
assert not report["http_errors"]
assert not report["missing_anchor_targets"]
assert all(not item["overflow"] for item in report["viewports"])
assert report["privacy_safe_root"]
