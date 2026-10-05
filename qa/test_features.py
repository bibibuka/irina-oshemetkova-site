"""Browser checks for local support tools. No messages are sent externally."""
from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright


BASE = "http://localhost:3000"
REPORT = Path(__file__).with_name("features-report.json")
checks = []
errors = []
requests = []


def close_open_dialog(page):
    while page.locator("dialog[open]").count():
        page.keyboard.press("Escape")


def check(name, action, page):
    try:
        close_open_dialog(page)
        action()
        checks.append({"name": name, "passed": True})
    except Exception as exc:
        checks.append({"name": name, "passed": False, "error": str(exc)})
        page.evaluate("document.querySelectorAll('dialog[open]').forEach(d => d.close())")


def guide_answer(page, value):
    page.locator(f'#guide-options [data-guide-value="{value}"]').click()
    page.locator("#guide-next").click()


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 1000}, reduced_motion="reduce")
    context.grant_permissions(["clipboard-read", "clipboard-write"], origin=BASE)

    def route_request(route):
        requests.append(route.request.url)
        if urlparse(route.request.url).hostname in {"localhost", "127.0.0.1"}:
            route.continue_()
        else:
            route.abort()

    context.route("**/*", route_request)
    page = context.new_page()
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    assert page.locator("#guide-dialog").count(), "New feature markup is not installed yet"
    initial_requests = len(requests)
    initial_storage = page.evaluate("({local: {...localStorage}, session: {...sessionStorage}})")

    def guide_navigation():
        page.locator("button[data-guide]").first.click()
        expect(page.locator("#guide-dialog")).to_be_visible()
        expect(page.locator("#guide-question")).to_be_focused()
        expect(page.locator("#guide-next")).to_be_disabled()
        expect(page.locator("#guide-back")).to_be_disabled()
        page.locator('[data-guide-value="pregnancy"]').click()
        expect(page.locator('[data-guide-value="pregnancy"]')).to_have_attribute("aria-pressed", "true")
        page.locator("#guide-next").click()
        page.locator('[data-guide-value="calm"]').click()
        page.locator("#guide-back").click()
        expect(page.locator('[data-guide-value="pregnancy"]')).to_have_attribute("aria-pressed", "true")
        page.locator("#guide-next").click()
        expect(page.locator('[data-guide-value="calm"]')).to_have_attribute("aria-pressed", "true")
        page.locator("#guide-next").click()
        guide_answer(page, "few")
        expect(page.locator("#guide-result")).to_be_visible()
        expect(page.locator("#guide-result-title")).to_be_focused()
        expect(page.locator("#guide-result-copy")).to_contain_text("В ожидании ребёнка")
        expect(page.locator("#guide-result-actions [data-grounding]")).to_be_visible()
        expect(page.locator("#guide-result-actions [data-booking]")).to_have_attribute("data-topic", "Поддержка в беременности: тревога и опора")
        page.locator("#guide-restart").click()
        expect(page.locator("#guide-next")).to_be_disabled()
        expect(page.locator('#guide-options [aria-pressed="true"]')).to_have_count(0)
        expect(page.locator("#guide-step")).to_have_text("Шаг 1 из 3")

    check("Guide: required answers, backtracking, focus, recommendation, restart", guide_navigation, page)

    def guide_routes():
        routes = [
            ("planning", "connection", "few", "builder", "На пути к материнству"),
            ("motherhood", "energy", "minute", "practice", "Среди забот о ребёнке"),
            ("loss", "calm", "few", "grounding", "У горя нет правильного расписания"),
            ("unsure", "talk", "talk", "booking", "необязательно сразу находить точные слова"),
        ]
        for stage, need, time, target, copy in routes:
            close_open_dialog(page)
            page.locator("button[data-guide]").first.click()
            for answer in (stage, need, time):
                guide_answer(page, answer)
            expect(page.locator("#guide-result-copy")).to_contain_text(copy)
            page.locator(f"#guide-result-actions [data-{target}]").click()
            expect(page.locator(f"#{target}-dialog")).to_be_visible()
            expect(page.locator("dialog[open]")).to_have_count(1)
            expect(page.locator("html")).to_have_class(re.compile("dialog-open"))
            if target == "booking":
                expect(page.locator("#booking-topic")).to_have_value("Хочу разобраться в своих чувствах: хочется быть услышанной")
        close_open_dialog(page)
        expect(page.locator("html")).not_to_have_class(re.compile("dialog-open"))

    check("Guide: all five stages and transitions to existing and new tools", guide_routes, page)

    def grounding_flow():
        page.locator("button[data-grounding]").first.click()
        expect(page.locator("#grounding-count")).to_have_text("5")
        expect(page.locator("#grounding-back")).to_be_disabled()
        for count in [4, 3, 2, 1]:
            page.locator("#grounding-next").click()
            expect(page.locator("#grounding-count")).to_have_text(str(count))
            expect(page.locator("#grounding-title")).to_be_focused()
            expect(page.locator(".grounding-dot.active")).to_have_count(1)
        page.locator("#grounding-back").click()
        expect(page.locator("#grounding-count")).to_have_text("2")
        page.locator("#grounding-next").click()
        page.locator("#grounding-next").click()
        expect(page.locator("#grounding-title")).to_have_text("Вы здесь")
        expect(page.locator("#grounding-next")).to_be_hidden()
        expect(page.locator(".grounding-dot.done")).to_have_count(5)
        page.locator("#grounding-restart").click()
        expect(page.locator("#grounding-count")).to_have_text("5")
        page.locator("#grounding-next").click()
        page.keyboard.press("Escape")
        page.locator("button[data-grounding]").first.click()
        expect(page.locator("#grounding-count")).to_have_text("5")

    check("Grounding: five steps, back, completion, restart, Escape reset", grounding_flow, page)

    def builder_flow():
        page.locator("button[data-builder]").first.click()
        for preset in ["rest", "listen", "chores"]:
            page.locator(f'[data-request-preset="{preset}"]').click()
            expect(page.locator(f'[data-request-preset="{preset}"]')).to_have_attribute("aria-pressed", "true")
        expect(page.locator("#builder-preview")).to_contain_text("взять на себя ужин сегодня?")
        page.locator("#builder-situation").fill("   я   устала   за день   ")
        page.locator("#builder-feeling").select_option("одиночество")
        page.locator("#builder-need").select_option("быть услышанной")
        page.locator("#builder-request").fill("  послушать   меня?? ")
        expect(page.locator("#builder-preview")).to_have_text("Когда я устала за день, я чувствую одиночество. Мне важно быть услышанной. Можешь, пожалуйста, послушать меня?")
        expect(page.locator('[data-request-preset][aria-pressed="true"]')).to_have_count(0)
        page.locator("#builder-copy").click()
        expect(page.locator("#builder-copy-status")).to_contain_text("Текст скопирован")
        assert page.evaluate("navigator.clipboard.readText()") == page.locator("#builder-preview").inner_text()
        page.locator("#builder-request").fill('<img src=x onerror="window.__bad=true">')
        expect(page.locator("#builder-preview img")).to_have_count(0)
        assert not page.evaluate("Boolean(window.__bad)")
        expect(page.locator("#builder-copy-status")).to_have_text("")
        page.locator("#builder-reset").click()
        assert "<img" not in page.locator("#builder-preview").inner_text()
        expect(page.locator("#builder-situation")).to_be_focused()
        page.locator("#builder-situation").press("Enter")
        expect(page.locator("#builder-dialog")).to_be_visible()

    check("Request builder: presets, edits, normalization, clipboard, safe text, reset", builder_flow, page)

    def clipboard_failure():
        page.locator("button[data-builder]").first.click()
        page.evaluate("""() => {
            window.__oldClipboard = navigator.clipboard.writeText;
            window.__oldExec = document.execCommand;
            navigator.clipboard.writeText = () => Promise.reject(new Error('denied'));
            document.execCommand = () => false;
        }""")
        page.locator("#builder-copy").click()
        expect(page.locator("#builder-copy-status")).to_contain_text("Не удалось скопировать автоматически")
        assert page.evaluate("getSelection().toString()") == page.locator("#builder-preview").inner_text()
        page.evaluate("() => { navigator.clipboard.writeText = window.__oldClipboard; document.execCommand = window.__oldExec; }")

    check("Request builder: denied clipboard gives a usable manual fallback", clipboard_failure, page)

    def comfort_mode():
        toggle = page.locator("#comfort-toggle")
        before = page.locator(".hero-description, .hero-copy p, main p").first.evaluate("el => parseFloat(getComputedStyle(el).fontSize)")
        toggle.click()
        expect(toggle).to_have_attribute("aria-pressed", "true")
        assert page.evaluate("document.documentElement.classList.contains('comfort-mode')")
        after = page.locator(".hero-description, .hero-copy p, main p").first.evaluate("el => parseFloat(getComputedStyle(el).fontSize)")
        assert after > before, f"Comfort mode did not enlarge text: {before} -> {after}"
        toggle.click()
        expect(toggle).to_have_attribute("aria-pressed", "false")

    check("Comfort mode: visible text grows and can return to default", comfort_mode, page)

    def mobile_tools():
        page.set_viewport_size({"width": 375, "height": 812})
        for tool in ["guide", "grounding", "builder"]:
            page.locator(f"button[data-{tool}]").first.click()
            dialog = page.locator(f"#{tool}-dialog")
            expect(dialog).to_be_visible()
            bounds = dialog.bounding_box()
            assert bounds and bounds["x"] >= -1 and bounds["x"] + bounds["width"] <= 376
            assert dialog.evaluate("el => el.scrollWidth <= el.clientWidth + 1"), f"{tool} overflows horizontally"
            page.keyboard.press("Escape")
            expect(dialog).to_be_hidden()
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")

    check("Mobile: all dialogs fit at 375px and Escape closes them", mobile_tools, page)

    check("Tools never write browser storage", lambda: (
        None if page.evaluate("({local: {...localStorage}, session: {...sessionStorage}})") == initial_storage
        else (_ for _ in ()).throw(AssertionError("Browser storage changed"))
    ), page)

    report = {
        "checks": checks,
        "passed": sum(item["passed"] for item in checks),
        "total": len(checks),
        "page_errors": errors,
        "new_network_requests": requests[initial_requests:],
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    browser.close()
    assert all(item["passed"] for item in checks) and not errors
