"""Functional checks of every feature on the page. Run with the preview server on:

    python server.py            # in one terminal
    python qa/test_features.py  # in another

No screenshots. External requests are blocked and reported; nothing may be written to
localStorage, sessionStorage or cookies until the visitor turns memory on.
"""
from __future__ import annotations

import re

from playwright.sync_api import expect

from _harness import BASE, new_context, open_page, session, show_panel, storage

EMPTY = {"local": {}, "session": {}, "cookies": ""}

with session("features") as (run, browser):
    context = new_context(browser, run, reduced_motion="reduce")
    page = open_page(context, run)
    html = page.locator("html")

    def no_storage():
        assert storage(page) == EMPTY, storage(page)

    print("Hero and stages")

    def hero():
        expect(page.locator("#okno-title")).to_contain_text("Быть мамой.")
        expect(page.locator("[data-greeting]")).not_to_be_empty()
        expect(page.locator("[data-badge-text]")).not_to_be_empty()
        page.locator("#okno [data-stage='postpartum']").click()
        expect(page.locator("#okno [data-stage='postpartum']")).to_have_attribute("aria-pressed", "true")
        expect(page.locator("[data-stage-reply]")).to_contain_text("Начнём с тебя")
        expect(page.locator("#sheet-settings [data-stage='postpartum']")).to_have_attribute("aria-pressed", "true")
        order = page.eval_on_selector_all("[data-flow-item]", "els => els.map(e => e.dataset.flowItem)")
        assert order[:2] == ["shelf", "words"], order
        assert page.eval_on_selector("[data-shelf-track] [data-shelf-item]", "e => e.dataset.shelfItem") == "stop"
        expect(page.locator("[data-doors] [aria-selected='true']")).to_have_attribute("data-door", "postpartum")
        no_storage()

    run.check("Stage choice: reply, chip, section order, shelf order, door — nothing stored", hero, page)

    def threshold():
        page.locator("#okno [data-stage='loss']").click()
        expect(page.locator("#sheet-threshold")).to_be_visible()
        expect(html).to_have_class(re.compile("is-quiet"))
        expect(page.locator("#okno-title")).to_contain_text("просто быть")
        page.locator("[data-threshold='read']").click()
        expect(page.locator("#sheet-threshold")).to_be_hidden()
        assert page.eval_on_selector("[data-flow] > [data-flow-item]", "e => e.dataset.flowItem") == "breath"
        show_panel(page, "polka")
        expect(page.locator("[data-shelf-item='flashback']")).to_be_visible()
        show_panel(page, "slova")
        expect(page.locator("#w-tab-loss")).to_be_visible()
        page.locator("#okno [data-stage='loss']").click()
        page.locator("[data-threshold='support']").click()
        expect(page.locator("#sheet-help")).to_be_visible()
        page.keyboard.press("Escape")
        page.locator("#okno [data-stage='none']").click()
        show_panel(page, "polka")
        expect(page.locator("#polka")).to_be_visible()
        expect(page.locator("[data-shelf-item='flashback']")).to_be_hidden()

    run.check("Loss: threshold sheet, quiet mode, calm title, loss-only blocks", threshold, page)

    def stage_in_settings():
        page.locator(".svet__col [data-action='settings']:not([data-focus])").click()
        expect(page.locator("#sheet-settings")).to_be_visible()
        page.locator("#sheet-settings [data-stage='pregnancy']").click()
        expect(page.locator("#sheet-settings [data-stage='pregnancy']")).to_have_attribute("aria-pressed", "true")
        expect(page.locator("#okno [data-stage='pregnancy']")).to_have_attribute("aria-pressed", "true")
        expect(page.locator("#sheet-settings")).to_be_visible()
        expect(page.locator("[data-breath-safety]")).to_contain_text("Ориентируйся на свой комфорт")
        page.keyboard.press("Escape")
        expect(page.locator("#sheet-settings")).to_be_hidden()

    run.check("Stage in «Как мне удобнее» changes the page; the sheet stays open", stage_in_settings, page)

    print("Selling frame and the practices block")

    def offer():
        cta = page.locator(".okno__actions .btn--primary")
        expect(cta).to_have_attribute("href", "#vstrecha")
        expect(cta).to_have_attribute("data-action", "write")
        expect(page.locator(".okno__terms")).to_contain_text("4 000 ₽")
        expect(page.locator("#uznaesh .thought-card")).to_have_count(8)
        expect(page.locator("#stoimost .plan")).to_have_count(2)
        expect(page.locator("#stoimost .plan--main")).to_contain_text("4 000 ₽")
        expect(page.locator("#stoimost .howto__step")).to_have_count(4)
        order = page.eval_on_selector_all("main > section", "els => els.map(e => e.id)")
        assert order == ["okno", "uznaesh", "dveri", "irina", "stoimost", "praktiki", "voprosy", "vstrecha"], order
        page.locator("#stoimost .plan:not(.plan--main) [data-action='write']").click()
        expect(page.locator("#letter-name")).to_be_focused(timeout=4000)
        expect(page.locator("[data-letter-preview]")).to_contain_text("встреча вдвоём")

    run.check("Offer in the first screen, «узнаёшь себя», pricing; page order; the pair plan fills the letter", offer, page)

    def practice_tabs():
        tabs = page.locator("#praktiki .ptab")
        expect(tabs).to_have_count(6)
        panels = ["pogoda", "dyhanie", "polka", "razbor", "slova", "opory"]
        for pid in panels:
            page.locator(f"#praktiki .ptab[aria-controls='{pid}']").click()
            visible = page.eval_on_selector_all("[data-tab-panel]", "els => els.filter(e => !e.hidden).map(e => e.id)")
            assert visible == [pid], (pid, visible)
            expect(page.locator(f"[aria-controls='{pid}']")).to_have_attribute("aria-selected", "true")
        # A «Что дальше» link in one panel opens another panel.
        page.locator("#praktiki .ptab[aria-controls='polka']").click()
        page.locator("#polka .next-line a[href='#razbor']").click()
        expect(page.locator("#razbor")).to_be_visible(timeout=4000)
        expect(page.locator("#polka")).to_be_hidden()
        # Arrow keys move along the tabs.
        page.locator("#praktiki .ptab[aria-selected='true']").focus()
        page.keyboard.press("Home")
        expect(page.locator("#praktiki .ptab").first).to_be_focused()
        expect(page.locator("#praktiki .ptab").first).to_have_attribute("aria-selected", "true")
        page.keyboard.press("ArrowRight")
        expect(page.locator("#praktiki .ptab").nth(1)).to_have_attribute("aria-selected", "true")
        page.evaluate("document.querySelector('#praktiki .ptab[aria-controls=pogoda]').click()")
        expect(page.locator("#bot")).to_contain_text("ИИ-ассистент")
        expect(page.locator(".praktiki__bridge [data-action='write']")).to_be_visible()

    run.check("Practices block: six tabs, one panel at a time, links and keys open the right tab", practice_tabs, page)

    def stage_tabs():
        page.locator("#okno [data-stage='postpartum']").click()
        order = page.eval_on_selector_all("#praktiki .ptab", "els => els.map(e => e.getAttribute('aria-controls'))")
        assert order == ["pogoda", "polka", "slova", "dyhanie", "razbor", "opory"], order
        page.locator("#okno [data-stage='none']").click()

    run.check("The chosen stage re-orders the practice tabs; check-in first, deck last", stage_tabs, page)

    print("Check-in")

    def checkin():
        show_panel(page, "pogoda")
        page.locator(".weather__tile[data-mood='meh']").click()
        expect(page.locator(".weather__tile[data-mood='meh']")).to_have_attribute("aria-checked", "true")
        expect(page.locator("[data-louder]")).to_be_visible()
        expect(page.locator("[data-checkin-answer] .step")).to_have_count(3)
        page.locator("[data-louder-value='loop']").click()
        expect(page.locator("[data-checkin-answer]")).to_contain_text("Разобрать мысль")
        page.locator(".weather__tile[data-mood='very-hard']").click()
        answer = page.locator("[data-checkin-answer]")
        expect(answer.locator("a[href='tel:112']").first).to_be_visible()
        expect(answer).to_contain_text("не экстренная служба")
        expect(page.locator("[data-louder]")).to_be_hidden()
        expect(html).to_have_class(re.compile("lamp-on"))
        expect(html).to_have_class(re.compile("is-quiet"))
        page.locator(".weather__tile[data-mood='good']").focus()
        page.keyboard.press("ArrowRight")
        expect(page.locator(".weather__tile[data-mood='ok']")).to_be_focused()
        expect(page.locator(".weather__tile[data-mood='ok']")).to_have_attribute("aria-checked", "true")
        no_storage()

    run.check("Check-in: phrase, ≤3 steps, louder routing, help first for «очень тяжело», arrows", checkin, page)

    print("Breathing")

    def breathing():
        show_panel(page, "dyhanie")
        page.locator("[data-breath-patterns] [data-pattern='478']").click()
        expect(page.locator("[data-breath-count]")).to_have_text("Вдох 4 — пауза 7 — выдох 8")
        page.locator("[data-breath-start]").click()
        expect(page.locator("[data-breath-phase]")).to_contain_text("Вдох")
        expect(page.locator("[data-breath-count]")).to_have_text("круг 1 из 3")
        expect(page.locator("[data-breath-stop]")).to_be_visible()
        page.locator("[data-breath-start]").click()
        expect(page.locator("[data-breath-phase]")).to_have_text("На паузе")
        page.locator("[data-breath-stop]").click()
        expect(page.locator("[data-breath-done]")).to_be_visible()
        expect(page.locator("[data-breath-done-phrase]")).to_contain_text("остановились")
        page.locator("[data-breath-done] [data-action='helped']").click()
        expect(page.locator("[data-helped-note]").first).to_contain_text("включи память")
        page.locator("[data-breath-patterns] [data-pattern='custom']").click()
        page.locator("[data-step='in'][data-delta='1']").click()
        expect(page.locator("[data-custom-in]")).to_have_text("5 с")
        no_storage()

    run.check("Breathing: rhythms, start, pause, «Достаточно», done panel, own rhythm", breathing, page)

    def breathe_action():
        page.locator("#sheet-help").evaluate("d => d.close()")
        page.locator(".site-header .help-link").click()
        page.locator("#sheet-help [data-action='breathe']").click()
        expect(page.locator("#sheet-help")).to_be_hidden()
        expect(page.locator("[data-breath-count]")).to_contain_text("круг 1 из", timeout=4000)
        page.locator("[data-breath-stop]").click()

    run.check("Breathe action from the help sheet closes it and starts 3–6", breathe_action, page)

    print("Help and emergency stop")

    def help_sheet():
        page.locator(".site-header .help-link").click()
        expect(page.locator("#sheet-help")).to_be_visible()
        expect(page.locator("#help-title")).to_be_focused()
        expect(page.locator("#sheet-help a.btn--danger[href='tel:112']")).to_be_visible()
        page.locator("#sheet-help [data-copy-number]").click()
        expect(page.locator("[data-help-status]")).to_contain_text("8-800-2000-122")
        page.keyboard.press("Escape")
        expect(page.locator("#sheet-help")).to_be_hidden()
        expect(page.locator(".site-header .help-link")).to_be_focused()

    run.check("Help sheet: focus on open, tel links, copy number, Esc returns focus", help_sheet, page)

    def stop():
        show_panel(page, "polka")
        page.locator("[data-shelf-item='stop'] [data-action='stop']").click()
        expect(page.locator("#sheet-stop")).to_be_visible()
        expect(page.locator("[data-stop-progress]")).to_have_text("Шаг 1 из 5")
        expect(page.locator("[data-stop-prev]")).to_be_hidden()
        for step in range(2, 6):
            page.locator("[data-stop-next]").click()
            expect(page.locator("[data-stop-progress]")).to_have_text(f"Шаг {step} из 5")
            expect(page.locator(f"#stop-{step}")).to_be_focused()
        page.keyboard.press("ArrowLeft")
        expect(page.locator("[data-stop-progress]")).to_have_text("Шаг 4 из 5")
        page.locator("#sheet-stop [data-copy-text]").click()
        expect(page.locator("[data-stop-status]")).to_contain_text("скопирован")
        href = page.locator("[data-share-sms]").evaluate("a => { a.addEventListener('click', e => e.preventDefault(), { once: true }); a.click(); return a.href; }")
        assert href.startswith("sms:?&body=") and "%D0%9C%D0%BD%D0%B5" in href, href
        page.keyboard.press("ArrowRight"); page.keyboard.press("ArrowRight")
        expect(page.locator("[data-stop-progress]")).to_have_text("Когда станет тише")
        expect(page.locator("[data-stop-next]")).to_be_hidden()

    run.check("Emergency stop: five steps, focus per step, arrows, copy, SMS text, final step", stop, page)

    print("Practices")

    def grounding():
        show_panel(page, "polka")
        page.locator("[data-shelf-item='grounding'] .shelf-item__open").click()
        expect(page.locator("#sheet-room")).to_be_visible()
        expect(page.locator("[data-room-progress]")).to_have_text("Шаг 1 из 5")
        expect(page.locator(".ground__dot")).to_have_count(5)
        page.locator(".ground__dot").first.click()
        expect(page.locator(".ground__dot").first).to_have_attribute("aria-pressed", "true")
        page.keyboard.press("ArrowRight")
        expect(page.locator(".ground__dot")).to_have_count(4)
        for _ in range(4):
            page.locator(".room__nav .btn--primary").click()
        expect(page.locator("[data-room-body]")).to_contain_text("Ты здесь.")
        page.locator("[data-room-enough]").click()
        expect(page.locator("#sheet-room")).to_be_hidden()

    run.check("Room 5-4-3-2-1: steps, dots, arrows, finish", grounding, page)

    def feelings():
        show_panel(page, "polka")
        page.locator("[data-shelf-item='feelings'] .shelf-item__open").click()
        page.locator("[data-zone-chip='chest']").click()
        page.locator(".room__nav .btn--primary").click()
        page.locator(".feel-pairs .seg").nth(0).locator("button").nth(0).click()
        page.locator(".room__nav .btn--primary").click()
        page.locator(".bubble-chip").nth(1).click()
        page.locator(".room__nav .btn--primary").click()
        expect(page.locator(".heard-card")).to_contain_text("Я услышала себя: в груди — тёплое. Оно говорит: «мне тревожно».")
        page.locator("[data-room-enough]").click()

    run.check("Room «Контакт с чувствами»: body zone, pair, voice, final card", feelings, page)

    def envelope():
        show_panel(page, "polka")
        page.locator("[data-shelf-item='envelope'] .shelf-item__open").click()
        page.locator(".envelope__field").fill("не успеваю ничего")
        page.locator(".room__actions .btn--ghost").click()
        expect(page.locator(".room__note")).to_contain_text("включи память")
        page.locator(".room__actions .btn--primary").click()
        expect(page.locator(".room__lead-big")).to_contain_text("Я вижу эти мысли", timeout=4000)
        page.locator("[data-room-enough]").click()
        no_storage()

    run.check("Room «Отложить мысли до утра»: no envelope without memory, let go", envelope, page)

    def choose():
        show_panel(page, "polka")
        page.locator("[data-shelf-item='choose'] .shelf-item__open").click()
        page.wait_for_function("document.getElementById('sheet-room').open || document.querySelector('[data-breath-stop]:not([hidden])')", timeout=5000)
        page.evaluate("document.querySelectorAll('dialog[open]').forEach(d => d.close())")
        if page.locator("[data-breath-stop]").is_visible():
            page.locator("[data-breath-stop]").click()

    run.check("«Выбери за меня» opens a practice", choose, page)

    print("Thought record and traps")

    def thought():
        show_panel(page, "razbor")
        page.locator("#situation-text").fill("после разговора с мамой")
        page.locator(".notebook__nav .btn--primary").click()
        page.locator("#thought-text").fill("Все думают обо мне, что я должна справляться сама")
        expect(page.locator("#thought-trap")).to_contain_text("Похоже на ловушку", timeout=3000)
        marks = page.eval_on_selector_all(".thought-field__mirror mark", "ms => ms.map(m => m.textContent)")
        assert "должна" in marks and "думают обо мне" in marks, marks
        page.locator(".notebook__nav .btn--primary").click()
        page.locator(".notebook .chip", has_text="тревога").click()
        page.locator(".strength__range").fill("9")
        expect(page.locator(".strength__range")).to_have_attribute("aria-valuetext", "невыносимо")
        page.locator(".notebook__nav .btn--primary").click()
        expect(page.locator(".notebook__safety")).to_contain_text("лучше не оставаться одной")
        page.locator(".notebook__nav .btn--ghost").click()
        page.locator(".strength__range").fill("6")
        page.locator(".notebook__nav .btn--primary").click()
        for _ in range(2):
            page.locator(".notebook__nav .btn--primary").click()
        page.locator("[data-thought-page] textarea").fill("Мне можно просить помощи")
        page.locator(".notebook__nav .btn--primary").click()
        page.locator(".strength__range").fill("6")
        page.locator(".notebook__nav .btn--primary").click()
        expect(page.locator(".notebook__outcome")).to_contain_text("это тоже нормально")
        expect(page.locator(".notebook__new")).to_have_text("«Мне можно просить помощи»")
        assert not re.search(r"\b\d+/10\b", page.locator("[data-thought-page]").inner_text())
        page.locator("text=Разобрать другую мысль").click()
        expect(page.locator("#situation-text")).to_have_value("")
        no_storage()

    run.check("Thought record: trap underline, safety branch, reframe, words not numbers", thought, page)

    def traps():
        show_panel(page, "razbor")
        expect(page.locator(".trap")).to_have_count(12)
        page.locator(".trap").first.click()
        expect(page.locator(".trap").first).to_have_attribute("aria-pressed", "true")
        page.locator("[data-trap-game] .chip").first.click()
        expect(page.locator(".trap-game__feedback")).not_to_be_empty()

    run.check("Twelve trap cards turn over; the game answers", traps, page)

    print("Words")

    def words():
        show_panel(page, "slova")
        page.locator("#w-tab-partner").click()
        expect(page.locator("#w-partner")).to_be_visible()
        expect(page.locator("#w-family")).to_be_hidden()
        page.locator("#w-partner .phrase").first.get_by_text("Скопировать").click()
        assert page.evaluate("navigator.clipboard.readText()").startswith("Пожалуйста, возьми коляску")
        page.locator("#w-tab-advice").click()
        page.locator("#w-advice .seg--tiny button", has_text="твёрже").click()
        expect(page.locator("#w-advice .phrase p").first).to_contain_text("Эту тему я закрываю")
        page.locator("#w-tab-own").click()
        page.locator(".builder__presets .link", has_text="Советы родных").click()
        expect(page.locator(".builder__result")).to_contain_text("Когда мне дают советы")
        page.locator("#w-tab-partner").click()
        page.locator("#w-partner .phrase").nth(1).get_by_text("Переделать под себя").click()
        expect(page.locator("#w-own")).to_be_visible()
        expect(page.locator(".builder__edit")).to_have_value(re.compile("^Я тревожусь"))

    run.check("Words: tabs, copy, softer/firmer, builder presets, rework", words, page)

    print("Deck")

    def deck():
        show_panel(page, "opory")
        page.locator(".deck__draw").click()
        expect(page.locator(".deck-card__text")).not_to_be_empty()
        first = page.locator(".deck-card__text").text_content()
        page.locator(".deck__draw").click()
        page.wait_for_timeout(500)
        assert page.locator(".deck-card__text").text_content() != first
        page.get_by_text("Оставить себе").click()
        expect(page.locator(".deck__note")).to_contain_text("включи память")
        no_storage()

    run.check("Deck: draw, no immediate repeat, keep needs memory", deck, page)

    print("Letter")

    def letter():
        page.locator("#letter-name").fill("Мария")
        page.locator("[data-letter-format] [data-value='spb']").click()
        page.locator("[data-letter-times] [data-value='вечером']").click()
        expect(page.locator("[data-letter-preview]")).to_contain_text("Ирина, здравствуйте! Меня зовут Мария. Хочу записаться на очную консультацию в Петербурге.")
        expect(page.locator("[data-letter-preview]")).to_contain_text("Мне обычно удобно вечером.")
        page.locator("#door-pregnancy [data-action='write']").evaluate("b => b.click()")
        expect(page.locator("[data-letter-preview]")).to_contain_text("тревога в беременности")
        assert page.locator("[data-letter-sms]").get_attribute("href").startswith("sms:+79217557171?&body=")
        assert "subject=" in page.locator("[data-letter-mail]").get_attribute("href")
        page.locator("#letter-topic").fill("не хочу жить")
        expect(page.locator(".letter .crisis-hint")).to_be_visible(timeout=3000)
        page.locator("#letter-topic").fill("")
        with context.expect_page() as popup:
            page.locator("[data-letter-telegram]").click()
        popup.value.close()
        expect(page.locator("[data-letter-status]")).to_contain_text("Текст скопирован")
        assert page.evaluate("navigator.clipboard.readText()").startswith("Ирина, здравствуйте!")
        no_storage()

    run.check("Letter: live preview on «вы», topics from doors, SMS/mail, crisis hint, copy + Telegram", letter, page)

    print("Irina, FAQ, settings and memory")

    def irina():
        page.locator(".principle").first.click()
        expect(page.locator(".principle").first).to_have_attribute("aria-pressed", "true")
        page.locator("[data-doc='1']").click()
        expect(page.locator("#sheet-doc")).to_be_visible()
        expect(page.locator("[data-lightbox-count]")).to_have_text("2 из 6")
        page.keyboard.press("ArrowRight")
        expect(page.locator("[data-lightbox-count]")).to_have_text("3 из 6")
        page.keyboard.press("Escape")
        expect(page.locator("[data-doc='2']")).to_be_focused()

    run.check("Irina: principle flips, lightbox with arrows returns focus to the shown document", irina, page)

    def memory():
        no_storage()
        page.locator(".svet [data-action='settings']").last.click()
        expect(page.locator("#sheet-settings")).to_be_visible()
        page.locator("[data-set='textLarge']").click()
        expect(html).to_have_class(re.compile("text-large"))
        no_storage()
        page.locator("[data-set='memory']").click()
        local = storage(page)["local"]
        assert local.get("io.v1.memory") == "on" and local.get("io.v1.textLarge") == "true", local
        expect(page.locator("[data-data-list]")).to_contain_text("Текст")
        page.locator("#sheet-settings [data-action='forget']").click()
        page.locator("#sheet-settings .forget-confirm .btn--danger-ghost").click()
        no_storage()
        expect(html).not_to_have_class(re.compile("text-large"))
        page.keyboard.press("Escape")

    run.check("Memory: off by default, on writes only io.v1.*, «Стереть всё» erases", memory, page)

    def theme():
        # The light version is the start; the moon turns the dark theme on and off.
        toggle = page.locator(".site-header .theme-toggle")
        expect(html).to_have_attribute("data-theme", "day")
        expect(toggle).to_have_attribute("aria-pressed", "false")
        toggle.click()
        expect(html).to_have_attribute("data-theme", "night", timeout=3000)
        expect(toggle).to_have_attribute("aria-pressed", "true")
        expect(page.locator("[data-footer-prefs]")).to_contain_text("Тёмная тема")
        toggle.click()
        expect(html).to_have_attribute("data-theme", "day", timeout=3000)
        expect(toggle).to_have_attribute("aria-pressed", "false")
        expect(page.locator("[data-footer-prefs]")).to_contain_text("Светлая тема")

    run.check("Moon in the header: dark theme on and off, footer summary", theme, page)

    print("Light by default, no night band")

    late = new_context(browser, run, reduced_motion="reduce", color_scheme="dark")
    late_page = open_page(late, run, "/?tod=night&stage=postpartum")

    def light_by_default():
        # 3 a.m. and a dark system theme: still the light version, and nothing of the night band is left.
        assert late_page.evaluate("document.documentElement.dataset.theme") == "day"
        assert late_page.evaluate("document.documentElement.classList.contains('night-hours')") is False
        expect(late_page.locator("#nochnik, [data-noise], .night-tile, [data-human-time]")).to_have_count(0)
        expect(late_page.locator("link[rel='manifest']")).to_have_count(0)
        assert late_page.evaluate("document.querySelector('main').previousElementSibling.tagName") != "SECTION"
        assert storage(late_page) == EMPTY
        late_page.goto(BASE + "/?theme=night")
        late_page.wait_for_selector("html[data-features='ready']")
        assert late_page.evaluate("document.documentElement.dataset.theme") == "night"

    run.check("Light at 3 a.m. and with a dark system; no night band, noise or install; dark only on request", light_by_default, late_page)

    print("Bot")

    def bot():
        expect(page.locator("[data-bot-greeting]")).not_to_be_empty()
        expect(page.locator("#bot")).to_contain_text("ИИ-ассистент, а не я лично")
        expect(page.locator(".bubble.is-waiting")).to_have_count(0)

    run.check("Bot demo: honest line, bubbles visible with reduced motion", bot, page)

    run.check("No cookies or storage were written during the whole visit", no_storage, page)
