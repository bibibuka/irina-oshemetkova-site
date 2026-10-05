"""Independent browser checks; never opens or sends to external contacts."""
from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright


BASE = "http://localhost:3000"
RESULT = Path(__file__).with_name("interactions.json")
checks = []
errors = []
external_requests = []


def run_check(name, action, page):
    try:
        action()
        checks.append({"name": name, "passed": True})
    except Exception as exc:
        checks.append({"name": name, "passed": False, "error": str(exc)})
        page.evaluate("document.querySelectorAll('dialog[open]').forEach(d => d.close())")


def assert_equal(actual, expected):
    assert actual == expected, f"Expected {expected!r}, received {actual!r}"


def close_dialog(page, selector):
    page.locator(f"{selector} [data-close]").click()
    expect(page.locator(selector)).not_to_be_visible()


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 1000}, reduced_motion="reduce")
    context.grant_permissions(["clipboard-read", "clipboard-write"], origin=BASE)
    page = context.new_page()
    page.on("pageerror", lambda error: errors.append(str(error)))

    def guard_external(route):
        if urlparse(route.request.url).hostname not in {"localhost", "127.0.0.1"}:
            external_requests.append(route.request.url)
            route.abort()
        else:
            route.continue_()

    context.route("**/*", guard_external)
    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    initial = {
        "title": page.title(),
        "dialogs": page.locator("dialog").evaluate_all("items => items.map(item => item.id)"),
        "stages": page.locator("button[data-stage]").count(),
        "education_documents": page.locator("#education-grid [data-certificate]").count(),
    }

    def stages():
        expect(page.locator("#stage-pregnancy")).to_have_attribute("aria-selected", "true")
        for stage in ["planning", "pregnancy", "motherhood", "loss"]:
            tab = page.locator(f"#stage-{stage}")
            tab.click()
            expect(tab).to_have_attribute("aria-selected", "true")
            expect(tab).to_have_attribute("tabindex", "0")
            expect(page.locator("#support-cards")).to_have_attribute("aria-labelledby", f"stage-{stage}")
            expect(page.locator("#support-cards article")).to_have_count(3)
            expect(page.locator("button[data-stage][aria-selected='true']")).to_have_count(1)
        page.locator("#stage-loss").press("ArrowRight")
        expect(page.locator("#stage-planning")).to_be_focused()
        page.locator("#stage-planning").press("End")
        expect(page.locator("#stage-loss")).to_be_focused()
        page.locator("#stage-loss").press("Home")
        expect(page.locator("#stage-planning")).to_be_focused()
        page.locator("#stage-planning").press("ArrowLeft")
        expect(page.locator("#stage-loss")).to_be_focused()

    run_check("Stage tabs, ARIA, keyboard wrap/Home/End", stages, page)

    def booking():
        trigger = page.locator("#support-cards [data-booking]").first
        topic = trigger.get_attribute("data-topic")
        trigger.click()
        expect(page.locator("#booking-dialog")).to_be_visible()
        expect(page.locator("#booking-topic")).to_have_value(topic)
        page.locator("#booking-compose").click()
        expect(page.locator("#booking-ready")).to_be_hidden()
        expect(page.locator("#booking-name")).to_be_focused()
        page.locator("#booking-name").fill("   ")
        page.locator("#booking-compose").click()
        expect(page.locator("#booking-ready")).to_be_hidden()
        assert page.locator("#booking-name").evaluate("el => !el.checkValidity()")
        page.locator("#booking-name").fill("Тестовая посетительница")
        page.locator("#booking-topic").fill("Проверка локального сайта, сообщение не отправляется.")
        page.locator("input[name='format'][value='offline']").check()
        page.locator("#booking-compose").click()
        expect(page.locator("#booking-ready")).to_be_visible()
        message = page.locator("#booking-message").input_value()
        assert "Тестовая посетительница" in message and "очно" in message
        assert "Проверка локального сайта" in message
        expect(page.locator("#booking-telegram")).to_have_attribute("href", "https://t.me/irinaoshemetkova")
        page.locator("#copy-message").click()
        expect(page.locator("#copy-message")).to_contain_text("Скопировано")
        assert_equal(page.evaluate("navigator.clipboard.readText()").replace("\r\n", "\n"), message)
        page.locator("#booking-topic").fill("Новая тема")
        expect(page.locator("#booking-ready")).to_be_hidden()
        page.locator("input[name='format'][value='online']").check()
        page.locator("#booking-compose").click()
        assert "онлайн" in page.locator("#booking-message").input_value()
        close_dialog(page, "#booking-dialog")
        expect(trigger).to_be_focused()
        assert_equal(page.url, BASE + "/")

    run_check("Booking validation, topic, formats, local compose, real clipboard, edit invalidation, focus", booking, page)

    def articles():
        for article in ["anxiety", "support", "selfcare"]:
            card = page.locator(f"[data-article='{article}']")
            card.click()
            expect(page.locator("#article-dialog")).to_be_visible()
            expect(page.locator("#article-body ol li")).to_have_count(3)
            title = page.locator("#article-title").inner_text()
            assert len(title) > 5
            if article == "anxiety":
                page.locator("#article-booking").click()
                expect(page.locator("#article-dialog")).to_be_hidden()
                expect(page.locator("#booking-dialog")).to_be_visible()
                expect(page.locator("#booking-topic")).to_have_value(title)
                close_dialog(page, "#booking-dialog")
                expect(card).to_be_focused()
            else:
                page.keyboard.press("Escape")
                expect(page.locator("#article-dialog")).to_be_hidden()
                expect(card).to_be_focused()

    run_check("Three articles, article-to-booking, Escape and focus restoration", articles, page)

    def education():
        opener = page.locator("[data-education]").first
        opener.click()
        expect(page.locator("#education-dialog")).to_be_visible()
        certificates = page.locator("#education-grid [data-certificate]")
        assert certificates.count() >= 1
        for index in range(certificates.count()):
            certificate = certificates.nth(index)
            source = certificate.get_attribute("data-certificate")
            caption = certificate.get_attribute("data-caption")
            certificate.click()
            expect(page.locator("#education-dialog")).to_be_hidden()
            expect(page.locator("#certificate-dialog")).to_be_visible()
            expect(page.locator("#certificate-image")).to_have_attribute("src", source)
            expect(page.locator("#certificate-image")).to_have_attribute("alt", caption)
            expect(page.locator("#certificate-caption")).to_have_text(caption)
            page.wait_for_function("document.querySelector('#certificate-image').complete && document.querySelector('#certificate-image').naturalWidth > 0")
            page.locator("#certificate-back").click()
            expect(page.locator("#certificate-dialog")).to_be_hidden()
            expect(page.locator("#education-dialog")).to_be_visible()
            expect(certificate).to_be_focused()
        certificates.first.click()
        page.keyboard.press("Escape")
        expect(page.locator("dialog[open]")).to_have_count(0)
        expect(opener).to_be_focused()
        opener.click()
        close_dialog(page, "#education-dialog")
        expect(opener).to_be_focused()

    run_check("Education: all six images, enlarge, caption, Back, Escape and focus", education, page)

    def privacy():
        trigger = page.locator("[data-privacy]")
        trigger.click()
        expect(page.locator("#privacy-dialog")).to_be_visible()
        expect(page.locator("html")).to_have_class("dialog-open")
        page.mouse.click(2, 2)
        expect(page.locator("#privacy-dialog")).to_be_hidden()
        expect(trigger).to_be_focused()
        expect(page.locator("html")).not_to_have_class(re.compile(r"\bdialog-open\b"))

    run_check("Privacy dialog, backdrop close and scroll-lock class", privacy, page)

    def mood():
        for value in ["tired", "anxious", "okay"]:
            button = page.locator(f"[data-mood='{value}']")
            button.click()
            expect(button).to_have_attribute("aria-pressed", "true")
            expect(page.locator("[data-mood][aria-pressed='true']")).to_have_count(1)
            expect(page.locator("#mood-response")).to_be_visible()
            assert len(page.locator("#mood-response p").inner_text()) > 20
            if value != "okay":
                page.locator("#mood-response [data-practice]").click()
                expect(page.locator("#practice-dialog")).to_be_visible()
                close_dialog(page, "#practice-dialog")
            else:
                expect(page.locator("#mood-response a")).to_have_attribute("href", "#support")

    run_check("All mood options and delegated practice actions", mood, page)

    def practice():
        page.clock.install()
        page.locator(".hero [data-practice]").click()
        expect(page.locator("#practice-time")).to_have_text("01:00")
        page.locator("#practice-start").click()
        expect(page.locator("#practice-phase")).to_have_text("Мягкий вдох")
        page.clock.fast_forward(4500)
        expect(page.locator("#practice-phase")).to_have_text("Спокойный выдох")
        page.locator("#practice-start").click()
        expect(page.locator("#practice-phase")).to_have_text("Пауза")
        paused = page.locator("#practice-time").inner_text()
        page.clock.fast_forward(8000)
        expect(page.locator("#practice-time")).to_have_text(paused)
        page.locator("#practice-start").click()
        expect(page.locator("#practice-start")).to_have_text("Пауза")
        page.locator("#practice-reset").click()
        expect(page.locator("#practice-time")).to_have_text("01:00")
        expect(page.locator("#practice-start")).to_have_text("Начать практику")
        page.locator("#practice-start").click()
        page.clock.fast_forward(60100)
        expect(page.locator("#practice-time")).to_have_text("00:00")
        expect(page.locator("#practice-start")).to_have_text("Повторить практику")
        expect(page.locator("#practice-phase")).to_have_text("Минута для себя")
        assert page.locator("#practice-progress").evaluate("el => el.style.width") == "100%"
        page.locator("#practice-start").click()
        expect(page.locator("#practice-start")).to_have_text("Пауза")
        page.clock.fast_forward(1500)
        close_dialog(page, "#practice-dialog")
        page.clock.fast_forward(10000)
        page.locator(".hero [data-practice]").click()
        expect(page.locator("#practice-time")).to_have_text("01:00")
        expect(page.locator("#practice-start")).to_have_text("Начать практику")
        close_dialog(page, "#practice-dialog")

    run_check("Practice: 4/6 phases, pause, resume, reset, full 60 seconds, retry, close cleanup", practice, page)

    def storage():
        assert_equal(page.evaluate("({local: localStorage.length, session: sessionStorage.length, cookies: document.cookie})"), {"local": 0, "session": 0, "cookies": ""})

    run_check("No localStorage, sessionStorage or cookies", storage, page)

    mobile = browser.new_page(viewport={"width": 390, "height": 844}, reduced_motion="reduce")
    mobile.on("pageerror", lambda error: errors.append(str(error)))
    mobile.goto(BASE)
    mobile.wait_for_load_state("networkidle")

    def menu():
        button = mobile.locator("#menu-toggle")
        expect(button).to_be_visible()
        expect(mobile.locator("#main-nav")).to_be_hidden()
        button.click()
        expect(button).to_have_attribute("aria-expanded", "true")
        expect(mobile.locator("#main-nav")).to_be_visible()
        mobile.locator("#main-nav a[href='#support']").click()
        expect(button).to_have_attribute("aria-expanded", "false")
        expect(mobile.locator("#main-nav")).to_be_hidden()
        mobile.wait_for_function("window.scrollY > 20")
        assert mobile.locator("#site-header").evaluate("el => el.classList.contains('scrolled')")
        button.click()
        mobile.keyboard.press("Escape")
        expect(button).to_have_attribute("aria-expanded", "false")
        assert mobile.evaluate("document.documentElement.scrollWidth <= innerWidth")

    run_check("Mobile menu, anchor close, Escape, header scroll, no horizontal overflow", menu, mobile)

    def mobile_booking():
        mobile.locator("#support-cards [data-booking]").first.click()
        expect(mobile.locator("#booking-dialog")).to_be_visible()
        mobile.locator("#booking-name").fill("Локальный мобильный тест")
        mobile.locator("#booking-compose").click()
        expect(mobile.locator("#booking-ready")).to_be_visible()
        close_dialog(mobile, "#booking-dialog")

    run_check("Mobile booking modal and compose", mobile_booking, mobile)
    mobile.close()
    report = {
        "base_url": BASE,
        "initial_dom": initial,
        "checks": checks,
        "passed": sum(check["passed"] for check in checks),
        "failed": sum(not check["passed"] for check in checks),
        "page_errors": errors,
        "external_requests": external_requests,
        "contact_messages_sent": 0,
    }
    RESULT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    browser.close()
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if report["failed"] or errors or external_requests:
        raise SystemExit(1)
