"""Layout, keyboard, history, phone dock, no-JS reading and server safety — on both pages. No screenshots.

    python server.py                # in one terminal
    python qa/test_interactions.py  # in another
"""
from __future__ import annotations

import re

from playwright.sync_api import expect

from _harness import BASE, new_context, open_page, session, show_panel

WIDTHS = [320, 360, 390, 768, 1024, 1180, 1440]
PAGES = ["/", "/praktiki.html"]

with session("interactions") as (run, browser):
    print("Layout")
    context = new_context(browser, run, reduced_motion="reduce")
    page = open_page(context, run)

    def go(path):
        page.goto(BASE + path)
        page.wait_for_selector("html[data-features='ready']")

    def no_overflow():
        problems = []
        for path in ["/", "/?theme=night&stage=postpartum", "/?stage=loss",
                     "/praktiki.html", "/praktiki.html?theme=night&stage=postpartum", "/praktiki.html?stage=loss"]:
            go(path)
            for width in WIDTHS:
                page.set_viewport_size({"width": width, "height": 860})
                page.wait_for_timeout(60)
                result = page.evaluate("() => ({ scroll: document.documentElement.scrollWidth, inner: innerWidth })")
                if result["scroll"] > result["inner"]:
                    wide = page.evaluate("""() => [...document.querySelectorAll('body *')].filter(el => {
                        const r = el.getBoundingClientRect(); return r.width && r.right > innerWidth + 1 && getComputedStyle(el).position !== 'fixed';
                    }).slice(0, 4).map(el => el.className || el.tagName)""")
                    problems.append({"path": path, "width": width, **result, "wide": wide})
        page.set_viewport_size({"width": 1440, "height": 1000})
        assert not problems, problems

    run.check("No horizontal scroll at 320–1440 px on both pages: light, dark theme and the loss stage", no_overflow)

    def text_large_320():
        results = {}
        for path in PAGES:
            go(path)
            page.set_viewport_size({"width": 320, "height": 740})
            page.evaluate("document.documentElement.classList.add('text-large')")
            page.wait_for_timeout(60)
            results[path] = page.evaluate("() => ({ scroll: document.documentElement.scrollWidth, inner: innerWidth })")
        page.set_viewport_size({"width": 1440, "height": 1000})
        bad = {path: r for path, r in results.items() if r["scroll"] > r["inner"]}
        assert not bad, bad

    run.check("Large text at 320 px still fits on both pages", text_large_320)

    def anchors_and_ids():
        ids = {}
        problems = {}
        for path in PAGES:
            go(path)
            ids[path] = set(page.evaluate("() => [...document.querySelectorAll('[id]')].map(e => e.id)"))
            missing = page.evaluate("""() => [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href')).filter(h => h.length > 1 && !document.getElementById(h.slice(1)))""")
            duplicates = page.evaluate("""() => { const seen = {}; document.querySelectorAll('[id]').forEach(e => seen[e.id] = (seen[e.id] || 0) + 1); return Object.keys(seen).filter(k => seen[k] > 1); }""")
            links = page.evaluate("""() => [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => /^(\\.\\/|praktiki\\.html)/.test(h))""")
            if missing or duplicates:
                problems[path] = {"missing": missing, "duplicates": duplicates}
            ids[path + ":links"] = links
        # Links between the pages point at ids that exist on the other page.
        for path in PAGES:
            for href in ids[path + ":links"]:
                target, _, anchor = href.partition("#")
                other = "/praktiki.html" if target.startswith("praktiki") else "/"
                if anchor and anchor not in ids[other]:
                    problems.setdefault(path, {}).setdefault("cross", []).append(href)
        assert not problems, problems

    run.check("Every link has a target, also between the pages; ids are unique", anchors_and_ids)

    def images():
        broken = {}
        for path in PAGES:
            go(path)
            shown = "[...document.querySelectorAll('main img[src]')].filter(i => i.getClientRects().length)"
            for index in range(page.evaluate(f"{shown}.length")):
                page.evaluate(f"{shown}[{index}].scrollIntoView()")
                page.wait_for_timeout(50)
            try:
                page.wait_for_function(f"{shown}.every(i => i.complete && i.naturalWidth > 0)", timeout=8000)
            except Exception:  # noqa: BLE001
                broken[path] = page.evaluate(f"{shown}.filter(i => !(i.complete && i.naturalWidth > 0)).map(i => i.src)")
        assert not broken, broken

    run.check("All images on both pages load", images)

    def names():
        unnamed = {}
        for path in PAGES:
            go(path)
            found = page.evaluate("""() => [...document.querySelectorAll('button, a[href], [role="tab"], [role="radio"], [role="switch"]')]
                .filter(el => !el.closest('[hidden]') && !(el.textContent.trim() || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title')))
                .map(el => el.outerHTML.slice(0, 90))""")
            if found:
                unnamed[path] = found
        assert not unnamed, unnamed

    run.check("Every button, link, tab and switch has an accessible name", names)

    print("Keyboard and history")
    prak = open_page(context, run, "/praktiki.html")

    def tabs():
        go("/")
        page.locator("#door-tab-planning").focus()
        page.keyboard.press("End")
        expect(page.locator("#door-tab-close")).to_be_focused()
        expect(page.locator("#door-close")).to_be_visible()
        page.keyboard.press("Home")
        expect(page.locator("#door-tab-planning")).to_have_attribute("aria-selected", "true")
        show_panel(prak, "slova")
        prak.locator("#w-tab-partner").click()
        prak.keyboard.press("ArrowRight")
        expect(prak.locator("#w-tab-family")).to_be_focused()
        prak.keyboard.press("End")
        expect(prak.locator("#w-tab-own")).to_be_focused()
        assert prak.locator("#w-tab-loss").is_hidden()

    run.check("Doors and words tabs: arrows, Home/End, hidden loss tab skipped", tabs, page)

    def back_closes_sheet():
        url = page.url
        page.locator(".site-header .help-link").click()
        expect(page.locator("#sheet-help")).to_be_visible()
        page.go_back()
        expect(page.locator("#sheet-help")).to_be_hidden()
        assert page.url == url, page.url
        page.locator(".site-header .help-link").click()
        page.locator("#sheet-help [data-close]").click()
        expect(page.locator("#sheet-help")).to_be_hidden()
        assert page.url == url

    run.check("«Назад» closes an open sheet and stays on the page", back_closes_sheet, page)

    def one_sheet():
        page.locator(".site-header .help-link").click()
        page.locator("#sheet-help [data-action='stop']").click()
        expect(page.locator("dialog[open]")).to_have_count(1)
        expect(page.locator("#sheet-stop")).to_be_visible()
        page.keyboard.press("Escape")
        expect(page.locator("dialog[open]")).to_have_count(0)
        expect(page.locator("html")).not_to_have_class(re.compile("is-locked"))

    run.check("Sheets never stack; scroll lock is released", one_sheet, page)

    def skip_link():
        go("/")
        page.keyboard.press("Tab")
        expect(page.locator(".skip-link").first).to_be_focused()
        page.keyboard.press("Tab")
        page.keyboard.press("Enter")
        expect(page.locator("#sheet-help")).to_be_visible()
        page.keyboard.press("Escape")

    run.check("Skip links: «К содержанию», then «Нужна помощь сейчас» opens help", skip_link, page)

    def static_timer():
        show_panel(prak, "dyhanie")
        prak.locator("[data-breath-start]").click()
        expect(prak.locator("[data-breath-phase]")).to_have_text(re.compile("…$"))
        assert prak.evaluate("document.querySelector('[data-breath]').classList.contains('is-static')")
        prak.locator("[data-breath-stop]").click()

    run.check("Reduced motion: breathing becomes a text timer", static_timer, prak)

    print("Phone")
    phone = new_context(browser, run, viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, reduced_motion="reduce")
    mobile = open_page(phone, run)

    def first_screen():
        # On a phone the first screen answers «мне сюда?», «можно доверять?» and «сколько и как записаться?».
        fold = 844 - mobile.evaluate("document.querySelector('.dock').getBoundingClientRect().height")
        for sel in [".okno__lead", ".okno__topics li:last-child", ".okno__actions .btn--primary", ".okno__terms", ".okno__proof li:first-child"]:
            box = mobile.locator(sel).bounding_box()
            assert box and box["y"] + min(box["height"], 30) <= fold, (sel, box, fold)

    run.check("Phone, first screen: who and with what, the booking button, price and the first trust fact", first_screen, mobile)

    def dock():
        dock_ = mobile.locator(".dock")
        expect(dock_).to_be_visible()
        expect(dock_.locator("a")).to_have_count(5)
        expect(mobile.locator(".site-nav")).to_be_hidden()
        mobile.locator(".dock__help").click()
        expect(mobile.locator("#sheet-help")).to_be_visible()
        box = mobile.locator("#sheet-help").bounding_box()
        assert box and box["y"] > 0 and abs(box["y"] + box["height"] - 844) < 2, box
        mobile.keyboard.press("Escape")
        mobile.locator(".dock a[href='#stoimost']").click()
        mobile.wait_for_timeout(400)
        assert mobile.evaluate("Math.abs(document.getElementById('stoimost').getBoundingClientRect().top)") < 200
        expect(mobile.locator(".dock a[href='praktiki.html']")).to_be_visible()

    run.check("Phone: five-cell dock with the practices page, help as a bottom sheet, dock links scroll", dock, mobile)

    def practices_dock():
        other = open_page(phone, run, "/praktiki.html")
        expect(other.locator(".dock a")).to_have_count(5)
        other.locator(".dock a[href='#slova']").click()
        expect(other.locator(".ptab[aria-controls='slova']")).to_have_attribute("aria-selected", "true", timeout=4000)
        expect(other.locator(".dock a[href='./#vstrecha']")).to_be_visible()
        show_panel(other, "polka")
        other.locator("[data-shelf-item='grounding'] .shelf-item__open").click()
        box = other.locator("#sheet-room").bounding_box()
        assert box and box["width"] == 390 and box["height"] >= 840, box
        other.locator("[data-room-enough]").click()
        other.close()

    run.check("Phone, practices page: its dock opens tabs and leads back to booking; rooms are full screen", practices_dock, mobile)

    print("Motion")
    moving = new_context(browser, run, reduced_motion="no-preference")
    lively = open_page(moving, run, "/?tod=day")

    def scroll_through(p):
        p.evaluate("""async () => {
            for (let y = 0; y < document.documentElement.scrollHeight; y += 400) {
                window.scrollTo({ top: y, behavior: 'instant' });
                await new Promise((resolve) => setTimeout(resolve, 70));
            }
        }""")
        p.wait_for_timeout(1600)
        stuck = p.evaluate("""() => [...document.querySelectorAll('[data-reveal]')]
            .filter((el) => el.getClientRects().length && !el.classList.contains('is-in'))
            .map((el) => el.id || el.className)""")
        hidden = p.evaluate("""() => [...document.querySelectorAll('main h1, main h2, footer h2')]
            .filter((el) => el.getClientRects().length)
            .filter((el) => { const word = el.querySelector('.w__i') || el; const style = getComputedStyle(word);
                return Number(style.opacity) < 0.99 || style.transform !== 'none'; })
            .map((el) => el.id || el.textContent.slice(0, 30))""")
        return stuck, hidden

    def headings_reveal():
        # Every heading and block that waits to rise must arrive once it has been scrolled to —
        # on the main page, and in every tab of the practices page, not only the one open at first.
        stuck, hidden = scroll_through(lively)
        other = open_page(moving, run, "/praktiki.html?tod=day")
        for pid in ["pogoda", "dyhanie", "polka", "razbor", "slova", "opory"]:
            show_panel(other, pid)
            s, h = scroll_through(other)
            stuck += s
            hidden += h
        other.close()
        assert not stuck, sorted(set(stuck))
        assert not hidden, sorted(set(hidden))

    run.check("Motion on: every heading and block arrives after scrolling, none stays hidden", headings_reveal, lively)

    def header_is_light():
        tools = lively.locator(".site-header a, .site-header button").count()
        assert tools <= 8, tools
        expect(lively.locator(".site-header .theme-toggle")).to_have_count(1)
        expect(lively.locator(".site-header .stage-chip")).to_have_count(0)

    run.check("Header: brand, four links, the dark-theme moon, help and the letter — nothing more", header_is_light, lively)

    def write_lands_on_letter():
        lively.evaluate("window.scrollTo({ top: 0, behavior: 'instant' })")
        lively.locator(".header-cta").click()
        expect(lively.locator("#letter-name")).to_be_focused(timeout=4000)
        top = lively.evaluate("document.querySelector('[data-letter]').getBoundingClientRect().top")
        assert 60 < top < 160, top

    run.check("«Записаться» brings the letter itself under the header and focuses the name", write_lands_on_letter, lively)

    print("Without JavaScript")
    nojs = new_context(browser, run, java_script_enabled=False)
    plain = nojs.new_page()
    plain.on("pageerror", lambda error: run.errors.append(str(error)))

    def readable_without_js():
        plain.goto(BASE + "/")
        assert plain.evaluate("document.documentElement.className") == "no-js"
        expect(plain.locator("#help-now a[href='tel:112']")).to_be_visible()
        expect(plain.locator("#help-now a[href='tel:88002000122']")).to_be_visible()
        expect(plain.locator(".door-panel")).to_have_count(5)
        for panel in plain.locator(".door-panel").all():
            expect(panel).to_be_visible()
        expect(plain.locator(".contacts a[href^='tel:']")).to_be_visible()
        expect(plain.locator(".js-only").first).to_be_hidden()
        expect(plain.locator(".dock")).to_be_hidden()
        # Without JS the practices page shows every practice one after another, no tabs.
        plain.goto(BASE + "/praktiki.html")
        expect(plain.locator(".shelf-item__steps").first).to_be_visible()
        for pid in ["pogoda", "dyhanie", "polka", "razbor", "slova", "opory"]:
            expect(plain.locator(f"#{pid}")).to_be_visible()
        expect(plain.locator(".ptabs")).to_be_hidden()
        expect(plain.locator("#help-now a[href='tel:112']")).to_be_visible()

    run.check("No JS: help numbers, contacts, all doors, and every practice are readable; tools hidden", readable_without_js, plain)

    print("Server")

    def server_safety():
        assert page.request.get(BASE + "/.env").status == 404
        assert page.request.get(BASE + "/assets/").status == 404
        assert page.request.get(BASE + "/../server.py").status == 404
        assert page.request.get(BASE + "/manifest.webmanifest").status == 404
        assert page.request.get(BASE + "/praktiki.html").status == 200

    run.check("Server: no .env, no directory listing, nothing outside dist; no web-app manifest; the practices page is served", server_safety)
