"""Functional browser checks for the site (no screenshots).

Run with the local server up:  python server.py  →  python qa/test_site.py
Checks: JS errors, external requests, browser storage, horizontal overflow at
phone-to-desktop widths, booking letter, stage tabs, every practice in the room,
help sheet, documents, phone menu and bar, theme toggle.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

BASE = os.environ.get("SITE_URL", "http://localhost:3000")
CHROME = os.environ.get("CHROME_PATH", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
REPORT = Path(__file__).with_name("site-report.json")

results: list[dict] = []
errors: list[str] = []
external: list[str] = []


def check(name, fn):
    try:
        fn()
        results.append({"name": name, "passed": True})
    except Exception as exc:  # noqa: BLE001 - report every failure, keep going
        results.append({"name": name, "passed": False, "error": f"{type(exc).__name__}: {exc}"[:600]})
        try:
            PAGE[0].evaluate("document.querySelectorAll('dialog[open]').forEach(d => d.close())")
        except Exception:  # noqa: BLE001
            pass


PAGE: list = []


def route(r):
    host = urlparse(r.request.url).hostname
    if host in {"localhost", "127.0.0.1"}:
        r.continue_()
    else:
        external.append(r.request.url)
        r.abort()


OVERFLOW_JS = """
() => {
  const vw = document.documentElement.clientWidth;
  const bad = [];
  const scrollers = el => { for (let p = el.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (['auto','scroll','hidden','clip'].includes(s.overflowX) && p !== document.body && p !== document.documentElement) return true; } return false; };
  for (const el of document.querySelectorAll('main *, header *, footer *')) {
    const r = el.getBoundingClientRect();
    if (!r.width || getComputedStyle(el).visibility === 'hidden') continue;
    if ((r.right > vw + 1 || r.left < -1) && !scrollers(el)) bad.push(`${el.tagName.toLowerCase()}.${(el.className && el.className.baseVal === undefined ? el.className : '').toString().split(' ')[0]} ${Math.round(r.left)}..${Math.round(r.right)}`);
  }
  return { scrollWidth: document.documentElement.scrollWidth, vw, bad: bad.slice(0, 8) };
}
"""


def open_practice(page, pid):
    page.evaluate("id => document.querySelector(`[data-practice-card='${id}'] .pcard__open`).click()", pid)
    page.wait_for_selector("#sheet-room[open]")
    page.wait_for_function("() => document.querySelector('[data-room-body]').children.length > 0")


def room(page):
    return page.locator("#sheet-room")


def close_room(page):
    page.keyboard.press("Escape")
    page.wait_for_selector("#sheet-room", state="hidden")


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(viewport={"width": 1440, "height": 960}, reduced_motion="reduce")
    ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin=BASE)
    ctx.route("**/*", route)
    page = ctx.new_page()
    PAGE.append(page)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("console", lambda m: errors.append(f"console: {m.text}") if m.type == "error" and "ERR_FAILED" not in m.text else None)
    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    page.wait_for_function("() => document.querySelector('[data-letter-topics]').children.length > 0")

    # ---------- Layout: no horizontal overflow ----------
    def overflow():
        problems = {}
        for width in (320, 375, 414, 768, 1024, 1280, 1440):
            page.set_viewport_size({"width": width, "height": 900})
            page.wait_for_timeout(150)
            info = page.evaluate(OVERFLOW_JS)
            if info["scrollWidth"] > info["vw"] or info["bad"]:
                problems[width] = info
        page.set_viewport_size({"width": 1440, "height": 960})
        assert not problems, json.dumps(problems, ensure_ascii=False)
    check("no horizontal overflow 320–1440", overflow)

    def theme():
        before = page.evaluate("document.documentElement.dataset.theme")
        page.click("[data-theme-toggle]")
        after = page.evaluate("document.documentElement.dataset.theme")
        assert before != after, (before, after)
        page.click("[data-theme-toggle]")
        assert page.evaluate("document.documentElement.dataset.theme") == before
    check("theme toggle", theme)

    def header_cta():
        page.click(".header-cta")
        page.wait_for_timeout(700)
        top = page.evaluate("document.querySelector('#zapis').getBoundingClientRect().top")
        assert abs(top) < 200, top
    check("header CTA scrolls to booking", header_cta)

    def doors():
        page.click("#door-tab-loss")
        assert page.is_visible("#door-loss") and not page.is_visible("#door-planning")
        page.focus("#door-tab-loss")
        page.keyboard.press("ArrowRight")
        assert page.is_visible("#door-close")
        page.click("#door-tab-pregnancy")
        page.click("#door-pregnancy [data-action='write']")
        page.wait_for_timeout(500)
        assert page.locator("[data-letter-topics] [aria-pressed='true'][data-value='тревога в беременности']").count() == 1
        assert "тревога в беременности" in page.inner_text("[data-letter-preview]")
    check("stage tabs and topic hand-off to the letter", doors)

    def letter():
        page.fill("#letter-name", "Мария")
        page.click("[data-letter-format] [data-value='spb']")
        page.click("[data-letter-days] [data-value='вечером']")
        text = page.inner_text("[data-letter-preview]")
        assert "Меня зовут Мария" in text and "очно в Петербурге" in text and "вечером" in text, text
        sms = page.get_attribute("[data-letter-sms]", "href")
        assert sms.startswith("sms:+79217557171?&body=") and "%D0%9C%D0%B0%D1%80%D0%B8%D1%8F" in sms
        with page.expect_popup() as pop:
            page.click("[data-letter-telegram]")
        pop.value.close()
        external[:] = [u for u in external if not u.startswith("https://t.me/irinaoshemetkova")]
        page.wait_for_function("() => document.querySelector('[data-letter-status]').textContent.length > 0")
        clip = page.evaluate("navigator.clipboard.readText()")
        assert "Меня зовут Мария" in clip, clip
    check("letter builder, SMS link and copy before Telegram", letter)

    def crisis_hint():
        page.fill("#letter-topic", "мне кажется, я не хочу жить")
        page.wait_for_timeout(700)
        assert page.locator(".crisis-hint").count() == 1
        page.fill("#letter-topic", "")
        page.wait_for_timeout(700)
        assert page.locator(".crisis-hint").count() == 0
    check("non-blocking crisis hint", crisis_hint)

    def filters():
        page.click("[data-filter='sleep']")
        visible = page.eval_on_selector_all("[data-practice-card]", "els => els.filter(e => !e.hidden).map(e => e.dataset.practiceCard)")
        assert set(visible) == {"breath", "envelope", "noise"}, visible
        page.click("[data-filter='hard']")
        assert page.is_visible("[data-practice-alert]")
        first = page.eval_on_selector("[data-practice-grid]", "g => [...g.children].find(c => !c.hidden).dataset.practiceCard")
        assert first == "stop", first
        page.click("[data-filter='all']")
        assert page.eval_on_selector_all("[data-practice-card]", "els => els.filter(e => e.hidden).length") == 0
        assert not page.is_visible("[data-practice-alert]")
    check("practice filter", filters)

    def p_breath():
        open_practice(page, "breath")
        assert room(page).locator(".breath__stage").count() == 1
        room(page).get_by_role("button", name="Начать").click()
        page.wait_for_timeout(1300)
        assert room(page).locator(".breath__phase").inner_text() in {"Вдох", "Выдох"}
        room(page).get_by_role("button", name="Достаточно").click()
        assert room(page).locator(".p-done").count() == 1
        # The bridge to booking (quiet wording once the visit entered quiet mode).
        assert room(page).locator(".p-cta button").count() == 1
        close_room(page)
    check("practice: breath", p_breath)

    def p_grounding():
        open_practice(page, "grounding")
        for _ in range(4):
            room(page).get_by_role("button", name="Дальше").click()
        assert room(page).locator(".g-step__num").inner_text() == "1"
        room(page).locator(".g-dots button").first.click()
        room(page).get_by_role("button", name="Готово").click()
        assert room(page).locator(".p-done").count() == 1
        close_room(page)
    check("practice: 5-4-3-2-1", p_grounding)

    def p_feelings():
        open_practice(page, "feelings")
        room(page).get_by_role("button", name="плечи").click()
        room(page).get_by_role("button", name="Дальше").click()
        room(page).get_by_role("button", name="сжатое").click()
        room(page).get_by_role("button", name="Дальше").click()
        room(page).get_by_role("button", name="«мне нужен отдых»").click()
        room(page).get_by_role("button", name="Готово").click()
        assert "плечи" in room(page).locator(".p-done").inner_text()
        close_room(page)
    check("practice: feelings", p_feelings)

    def p_envelope():
        open_practice(page, "envelope")
        room(page).locator(".env-paper").fill("завтра анализы, не успела ответить маме")
        room(page).get_by_role("button", name="Запечатать до утра").click()
        page.wait_for_selector("#sheet-room .env-seal")
        close_room(page)
    check("practice: envelope", p_envelope)

    def p_thought():
        open_practice(page, "thought")
        room(page).locator("textarea").fill("Вечер, малыш долго не засыпал")
        room(page).get_by_role("button", name="Дальше").click()
        room(page).locator("textarea").fill("Я плохая мать, раз не могу его успокоить")
        page.wait_for_timeout(100)
        assert "Ярлыки" in room(page).locator(".t-detect").inner_text()
        room(page).get_by_role("button", name="Дальше").click()
        room(page).get_by_role("button", name="вина").click()
        room(page).get_by_role("button", name="Дальше").click()
        room(page).locator("textarea").fill("Мне сейчас очень трудно, и я всё равно стараюсь")
        room(page).locator("input[type=range]").fill("3")
        room(page).get_by_role("button", name="Показать итог").click()
        out = room(page).locator(".t-result").inner_text()
        assert "Я плохая мать" in out and "стараюсь" in out, out
        close_room(page)
        open_practice(page, "thought")
        room(page).locator("textarea").fill("Ночью")
        room(page).get_by_role("button", name="Дальше").click()
        room(page).locator("textarea").fill("Всё ужасно")
        room(page).get_by_role("button", name="Дальше").click()
        room(page).locator("input[type=range]").fill("10")
        room(page).get_by_role("button", name="Дальше").click()
        assert room(page).locator(".t-safety").count() == 1
        close_room(page)
    check("practice: thought work + safety branch", p_thought)

    def p_traps():
        open_practice(page, "traps")
        assert room(page).locator(".trap").count() == 12
        card = room(page).locator(".trap").first
        card.click()
        assert card.get_attribute("aria-pressed") == "true"
        room(page).locator(".trap-game__options button").first.click()
        assert room(page).locator(".trap-game__feedback").inner_text().strip()
        close_room(page)
    check("practice: thinking traps", p_traps)

    def p_words():
        open_practice(page, "words")
        assert room(page).get_by_role("tab").count() == 5
        room(page).get_by_role("tab", name="После утраты").click()
        assert room(page).locator(".help-memo").count() == 1
        close_room(page)
    check("practice: words", p_words)

    def p_request():
        open_practice(page, "request")
        room(page).get_by_role("button", name="Хочу отдохнуть").click()
        out = room(page).locator(".rq-result").inner_text()
        assert "я весь день одна с малышом" in out and "отдохнуть" in out, out
        close_room(page)
    check("practice: request builder", p_request)

    def p_deck():
        open_practice(page, "deck")
        room(page).get_by_role("button", name="Вытянуть карту").click()
        page.wait_for_timeout(100)
        assert room(page).locator(".deck__phrase").inner_text().strip()
        room(page).get_by_role("button", name="Ещё одну").click()
        page.wait_for_timeout(500)
        assert room(page).locator(".deck__phrase").inner_text().strip()
        close_room(page)
    check("practice: deck", p_deck)

    def p_noise():
        open_practice(page, "noise")
        room(page).get_by_role("button", name="Глубокий").click()
        room(page).locator(".noise .btn--large").click()
        page.wait_for_timeout(600)
        status = room(page).locator(".noise__status").inner_text()
        assert status, status
        close_room(page)
        page.evaluate("document.querySelector('[data-practice-card=noise] .pcard__open').click()")
        page.wait_for_selector("#sheet-room[open]")
        btn = room(page).locator(".noise .btn--large")
        if "Выключить" in btn.inner_text():
            btn.click()
        close_room(page)
    check("practice: sleep noise", p_noise)

    def p_flashback():
        open_practice(page, "flashback")
        assert "Сейчас" in room(page).locator(".fb-anchor").inner_text()
        room(page).get_by_role("button", name="Готово").click()
        assert room(page).get_by_role("button", name="Написать Ирине").count() == 1
        close_room(page)
    check("practice: flashback (quiet)", p_flashback)

    def p_stop():
        open_practice(page, "stop")
        assert "is-dark" in (room(page).get_attribute("class") or "")
        for _ in range(5):
            room(page).get_by_role("button", name="Дальше").click()
        assert "Когда станет тише" in room(page).inner_text()
        room(page).get_by_role("button", name="Обсудить с Ириной").click()
        page.wait_for_selector("#sheet-room", state="hidden")
        page.wait_for_timeout(600)
        assert page.locator("[data-letter-topics] [aria-pressed='true'][data-value='как разделить нагрузку, когда сил совсем мало']").count() == 1
    check("practice: emergency stop → booking", p_stop)

    def random_choice():
        page.click("[data-practice='random']")
        page.wait_for_selector("#sheet-room[open]")
        close_room(page)
    check("practice: choose for me", random_choice)

    def help_sheet():
        page.click(".help-link")
        page.wait_for_selector("#sheet-help[open]")
        assert "is-quiet" in page.evaluate("document.documentElement.className")
        page.keyboard.press("Escape")
        page.wait_for_selector("#sheet-help", state="hidden")
    check("help sheet opens and closes", help_sheet)

    def docs():
        page.click(".doc[data-doc='1']")
        page.wait_for_selector("#sheet-doc[open]")
        src = page.get_attribute("[data-lightbox-img]", "src")
        assert "education-05" in src, src
        page.click("[data-lightbox-next]")
        assert "education-04" in page.get_attribute("[data-lightbox-img]", "src")
        page.keyboard.press("Escape")
    check("documents lightbox", docs)

    def phone():
        page.set_viewport_size({"width": 390, "height": 844})
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(300)
        page.click(".menu-btn")
        page.wait_for_selector("#sheet-menu[open]")
        page.click("#sheet-menu [href='#stoimost']")
        page.wait_for_selector("#sheet-menu", state="hidden")
        page.wait_for_timeout(800)
        top = page.evaluate("document.querySelector('#stoimost').getBoundingClientRect().top")
        assert abs(top) < 200, top
        assert page.evaluate("document.querySelector('[data-mbar]').classList.contains('is-visible')")
        page.set_viewport_size({"width": 1440, "height": 960})
    check("phone menu and booking bar", phone)

    def privacy():
        storage = page.evaluate("({ local: localStorage.length, session: sessionStorage.length, cookies: document.cookie })")
        assert storage == {"local": 0, "session": 0, "cookies": ""}, storage
        assert not external, external[:5]
    check("nothing stored, nothing sent", privacy)

    browser.close()

passed = sum(r["passed"] for r in results)
report = {"passed": passed, "total": len(results), "results": results, "errors": errors, "external_requests": external}
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
for r in results:
    print(("PASS " if r["passed"] else "FAIL ") + r["name"] + ("" if r["passed"] else f"\n     {r['error']}"))
print(f"\n{passed}/{len(results)} passed; JS errors: {len(errors)}")
for e in errors[:10]:
    print("  ", e)
sys.exit(0 if passed == len(results) and not errors else 1)
