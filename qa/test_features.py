"""Functional checks of both pages. Run with the preview server on:

    python server.py            # in one terminal
    python qa/test_features.py  # in another

The main page (/) sells: who and with what, why trust, price, FAQ, the letter.
The practices page (/praktiki.html) holds the practices as a bonus.
No screenshots. External requests are blocked and reported; nothing may be written to
localStorage, sessionStorage or cookies until the visitor turns memory on.
"""
from __future__ import annotations

import re
from urllib.parse import unquote

from playwright.sync_api import expect

from _harness import BASE, new_context, open_page, session, show_panel, storage

EMPTY = {"local": {}, "session": {}, "cookies": ""}

with session("features") as (run, browser):
    context = new_context(browser, run, reduced_motion="reduce")
    page = open_page(context, run)
    prak = open_page(context, run, "/praktiki.html")
    html = page.locator("html")
    phtml = prak.locator("html")

    def no_storage():
        assert storage(page) == EMPTY, storage(page)
        assert storage(prak) == EMPTY, storage(prak)

    print("Main page: the offer")

    def offer():
        expect(page.locator("#okno-title")).to_contain_text("Быть мамой")
        expect(page.locator("[data-greeting]")).not_to_be_empty()
        expect(page.locator("#okno .okno__lead")).to_contain_text("репродуктивный и перинатальный психолог")
        expect(page.locator(".okno__topics li")).to_have_count(5)
        expect(page.locator(".okno__topics")).to_contain_text("ЭКО")
        expect(page.locator(".okno__topics")).to_contain_text("РПП")
        proof = page.locator(".okno__proof")
        expect(proof.locator("li")).to_have_count(3)
        for fact in ["Работаю в медицине", "Преподаю", "Первое место"]:
            expect(proof).to_contain_text(fact)
        # One button on the first screen, and it books: no link away to the practices.
        expect(page.locator(".okno__actions a, .okno__actions button")).to_have_count(1)
        cta = page.locator(".okno__actions .btn--primary")
        expect(cta).to_have_attribute("href", "#vstrecha")
        expect(cta).to_have_attribute("data-action", "write")
        expect(page.locator(".okno__terms")).to_contain_text("4 000 ₽")
        expect(page.locator("#stoimost .plan")).to_have_count(2)
        expect(page.locator("#stoimost .plan--main")).to_contain_text("4 000 ₽")
        expect(page.locator("#stoimost .terms dt")).to_have_count(3)
        expect(page.locator("#stoimost .howto__step")).to_have_count(4)
        order = page.eval_on_selector_all("main > section", "els => els.map(e => e.id)")
        assert order == ["okno", "dveri", "irina", "stoimost", "voprosy", "vstrecha"], order
        # The practices are a page of their own: nothing of them is left on the main page.
        expect(page.locator("#praktiki, [data-tab-panel], .ptabs, #bot, [data-stage-pick], .uznaesh, .podhod, .principle")).to_have_count(0)
        expect(page.locator(".site-nav a[href='praktiki.html']")).to_have_count(1)
        expect(page.locator(".site-nav a[href='praktiki.html'] .site-nav__tag")).to_have_text("без записи")
        expect(page.locator(".dock a[href='praktiki.html']")).to_have_count(1)
        # After the booking, the practices are offered as a card the whole of which is a link — still, no motion.
        card = page.locator("#vstrecha .bonus-card")
        expect(card).to_have_attribute("href", "praktiki.html")
        expect(card).to_contain_text("практики без записи")
        assert card.evaluate("e => getComputedStyle(e).animationName") == "none"
        page.locator("#stoimost .plan:not(.plan--main) [data-action='write']").click()
        expect(page.locator("#letter-name")).to_be_focused(timeout=4000)
        expect(page.locator("[data-letter-preview]")).to_contain_text("встреча вдвоём")

    run.check("Main page: who and with what, trust facts, one booking button, price and terms; no practices", offer, page)

    def stage_by_link():
        # The stage is chosen on the practices page; a remembered or linked stage still changes the title here.
        loss = open_page(context, run, "/?stage=loss&tod=day")
        expect(loss.locator("#okno-title")).to_contain_text("просто быть")
        expect(loss.locator("#okno .okno__lead")).to_contain_text("репродуктивный и перинатальный психолог")
        expect(loss.locator("html")).to_have_class(re.compile("is-quiet"))
        expect(loss.locator("[data-doors] [aria-selected='true']")).to_have_attribute("data-door", "loss")
        assert loss.locator(".irina__drop [data-not-loss]").evaluate("e => getComputedStyle(e).display") == "none"
        loss.close()
        baby = open_page(context, run, "/?stage=postpartum&tod=day")
        expect(baby.locator("[data-doors] [aria-selected='true']")).to_have_attribute("data-door", "postpartum")
        baby.close()

    run.check("A stage from the link: calm title on loss, the lead keeps who Irina is, the matching door opens", stage_by_link, page)

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
        # The hint leaves 450 ms after the text is cleared and the send buttons move up: click after that.
        expect(page.locator(".letter .crisis-hint")).to_have_count(0)
        with context.expect_page() as popup:
            page.locator("[data-letter-telegram]").click()
        popup.value.close()
        expect(page.locator("[data-letter-status]")).to_contain_text("Текст скопирован")
        assert page.evaluate("navigator.clipboard.readText()").startswith("Ирина, здравствуйте!")
        no_storage()

    run.check("Letter: live preview on «вы», topics from doors, SMS/mail, crisis hint, copy + Telegram", letter, page)

    def source():
        # «Как ты обо мне узнала?» — optional, one answer, it only goes into the letter text.
        chips = page.locator("[data-letter-source] [data-value]")
        expect(chips).to_have_count(4)
        expect(page.locator("[data-letter-preview]")).not_to_contain_text("Откуда я о вас знаю")
        page.locator("[data-letter-source] [data-value='doctor']").click()
        expect(page.locator("[data-letter-preview]")).to_contain_text("Откуда я о вас знаю: от врача.")
        page.locator("[data-letter-source] [data-value='telegram']").click()
        expect(page.locator("[data-letter-preview]")).to_contain_text("Откуда я о вас знаю: из Telegram.")
        expect(page.locator("[data-letter-source] [aria-pressed='true']")).to_have_count(1)
        sms = unquote(page.locator("[data-letter-sms]").get_attribute("href"))
        assert "Откуда я о вас знаю: из Telegram." in sms, sms
        page.locator("[data-letter-source] [data-value='telegram']").click()
        expect(page.locator("[data-letter-source] [aria-pressed='true']")).to_have_count(0)
        expect(page.locator("[data-letter-preview]")).not_to_contain_text("Откуда я о вас знаю")
        no_storage()

    run.check("«Как ты обо мне узнала?»: optional, one answer, goes into the letter, a second tap takes it back", source, page)

    print("About, FAQ, help, settings and memory")

    def irina():
        expect(page.locator(".irina__facts")).to_contain_text("Преподаю в университете")
        expect(page.locator(".irina__facts")).to_contain_text("Первое место")
        page.locator("[data-doc='1']").click()
        expect(page.locator("#sheet-doc")).to_be_visible()
        expect(page.locator("[data-lightbox-count]")).to_have_text("2 из 6")
        page.keyboard.press("ArrowRight")
        expect(page.locator("[data-lightbox-count]")).to_have_text("3 из 6")
        page.keyboard.press("Escape")
        expect(page.locator("[data-doc='2']")).to_be_focused()

    run.check("About: facts, lightbox with arrows returns focus to the shown document", irina, page)

    def help_sheet():
        page.locator(".site-header .help-link").click()
        expect(page.locator("#sheet-help")).to_be_visible()
        expect(page.locator("#help-title")).to_be_focused()
        expect(page.locator("#sheet-help a.btn--danger[href='tel:112']")).to_be_visible()
        expect(page.locator("#sheet-help a[href='praktiki.html#dyhanie']")).to_be_visible()
        page.locator("#sheet-help [data-copy-number]").click()
        expect(page.locator("[data-help-status]")).to_contain_text("8-800-2000-122")
        page.keyboard.press("Escape")
        expect(page.locator("#sheet-help")).to_be_hidden()
        expect(page.locator(".site-header .help-link")).to_be_focused()

    run.check("Help sheet: focus on open, tel links, copy number, breathing on the practices page, Esc returns focus", help_sheet, page)

    def stop():
        page.locator(".site-header .help-link").click()
        page.locator("#sheet-help [data-action='stop']").click()
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

    run.check("Emergency stop from the help sheet: five steps, focus per step, arrows, copy, SMS text, final step", stop, page)

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

    print("Practices page: stages")

    def hero():
        expect(prak.locator("h1#praktiki-title")).to_contain_text("Практики")
        prak.locator("[data-stage-pick] [data-stage='postpartum']").click()
        expect(prak.locator("[data-stage-pick] [data-stage='postpartum']")).to_have_attribute("aria-pressed", "true")
        expect(prak.locator("[data-stage-reply]")).to_contain_text("Начнём с тебя")
        expect(prak.locator("#sheet-settings [data-stage='postpartum']")).to_have_attribute("aria-pressed", "true")
        order = prak.eval_on_selector_all("[data-flow-item]", "els => els.map(e => e.dataset.flowItem)")
        assert order[:2] == ["shelf", "words"], order
        assert prak.eval_on_selector("[data-shelf-track] [data-shelf-item]", "e => e.dataset.shelfItem") == "stop"
        no_storage()

    run.check("Stage choice on the practices page: reply, chip, tab order, shelf order — nothing stored", hero, prak)

    def threshold():
        prak.locator("[data-stage-pick] [data-stage='loss']").click()
        expect(prak.locator("#sheet-threshold")).to_be_visible()
        expect(phtml).to_have_class(re.compile("is-quiet"))
        prak.locator("[data-threshold='read']").click()
        expect(prak.locator("#sheet-threshold")).to_be_hidden()
        assert prak.eval_on_selector("[data-flow] > [data-flow-item]", "e => e.dataset.flowItem") == "breath"
        # «Я готова читать» opens the first practice a moment later: let it land before switching tabs.
        expect(prak.locator(".ptab[aria-controls='dyhanie']")).to_have_attribute("aria-selected", "true")
        show_panel(prak, "polka")
        expect(prak.locator("[data-shelf-item='flashback']")).to_be_visible()
        show_panel(prak, "slova")
        expect(prak.locator("#w-tab-loss")).to_be_visible()
        prak.locator("[data-stage-pick] [data-stage='loss']").click()
        prak.locator("[data-threshold='support']").click()
        expect(prak.locator("#sheet-help")).to_be_visible()
        prak.keyboard.press("Escape")
        prak.locator("[data-stage-pick] [data-stage='none']").click()
        show_panel(prak, "polka")
        expect(prak.locator("#polka")).to_be_visible()
        expect(prak.locator("[data-shelf-item='flashback']")).to_be_hidden()

    run.check("Loss: threshold sheet, quiet mode, loss-only blocks", threshold, prak)

    def stage_in_settings():
        prak.locator(".svet__col [data-action='settings']:not([data-focus])").click()
        expect(prak.locator("#sheet-settings")).to_be_visible()
        prak.locator("#sheet-settings [data-stage='pregnancy']").click()
        expect(prak.locator("#sheet-settings [data-stage='pregnancy']")).to_have_attribute("aria-pressed", "true")
        expect(prak.locator("[data-stage-pick] [data-stage='pregnancy']")).to_have_attribute("aria-pressed", "true")
        expect(prak.locator("#sheet-settings")).to_be_visible()
        expect(prak.locator("[data-breath-safety]")).to_contain_text("Ориентируйся на свой комфорт")
        prak.keyboard.press("Escape")
        expect(prak.locator("#sheet-settings")).to_be_hidden()

    run.check("Stage in «Как мне удобнее» changes the page; the sheet stays open", stage_in_settings, prak)

    print("Practices page: tabs")

    def practice_tabs():
        tabs = prak.locator("#praktiki .ptab")
        expect(tabs).to_have_count(6)
        panels = ["pogoda", "dyhanie", "polka", "razbor", "slova", "opory"]
        for pid in panels:
            prak.locator(f"#praktiki .ptab[aria-controls='{pid}']").click()
            visible = prak.eval_on_selector_all("[data-tab-panel]", "els => els.filter(e => !e.hidden).map(e => e.id)")
            assert visible == [pid], (pid, visible)
            expect(prak.locator(f"[aria-controls='{pid}']")).to_have_attribute("aria-selected", "true")
        # A «Что дальше» link in one panel opens another panel.
        prak.locator("#praktiki .ptab[aria-controls='polka']").click()
        prak.locator("#polka .next-line a[href='#razbor']").click()
        expect(prak.locator("#razbor")).to_be_visible(timeout=4000)
        expect(prak.locator("#polka")).to_be_hidden()
        # Arrow keys move along the tabs.
        prak.locator("#praktiki .ptab[aria-selected='true']").focus()
        prak.keyboard.press("Home")
        expect(prak.locator("#praktiki .ptab").first).to_be_focused()
        expect(prak.locator("#praktiki .ptab").first).to_have_attribute("aria-selected", "true")
        prak.keyboard.press("ArrowRight")
        expect(prak.locator("#praktiki .ptab").nth(1)).to_have_attribute("aria-selected", "true")
        prak.evaluate("document.querySelector('#praktiki .ptab[aria-controls=pogoda]').click()")
        expect(prak.locator("#bot")).to_contain_text("ИИ-ассистент")
        expect(prak.locator(".praktiki__bridge a[href='./#vstrecha']")).to_be_visible()
        expect(prak.locator(".site-nav a[aria-current='page']")).to_have_attribute("href", "#praktiki")

    run.check("Practices: six tabs, one panel at a time, links and keys open the right tab, the way back to booking", practice_tabs, prak)

    def stage_tabs():
        prak.locator("[data-stage-pick] [data-stage='postpartum']").click()
        order = prak.eval_on_selector_all("#praktiki .ptab", "els => els.map(e => e.getAttribute('aria-controls'))")
        assert order == ["pogoda", "polka", "slova", "dyhanie", "razbor", "opory"], order
        prak.locator("[data-stage-pick] [data-stage='none']").click()

    run.check("The chosen stage re-orders the practice tabs; check-in first, deck last", stage_tabs, prak)

    print("Check-in")

    def checkin():
        show_panel(prak, "pogoda")
        prak.locator(".weather__tile[data-mood='meh']").click()
        expect(prak.locator(".weather__tile[data-mood='meh']")).to_have_attribute("aria-checked", "true")
        expect(prak.locator("[data-louder]")).to_be_visible()
        expect(prak.locator("[data-checkin-answer] .step")).to_have_count(3)
        prak.locator("[data-louder-value='loop']").click()
        expect(prak.locator("[data-checkin-answer]")).to_contain_text("Разобрать мысль")
        prak.locator(".weather__tile[data-mood='very-hard']").click()
        answer = prak.locator("[data-checkin-answer]")
        expect(answer.locator("a[href='tel:112']").first).to_be_visible()
        expect(answer).to_contain_text("не экстренная служба")
        expect(prak.locator("[data-louder]")).to_be_hidden()
        expect(phtml).to_have_class(re.compile("lamp-on"))
        expect(phtml).to_have_class(re.compile("is-quiet"))
        prak.locator(".weather__tile[data-mood='good']").focus()
        prak.keyboard.press("ArrowRight")
        expect(prak.locator(".weather__tile[data-mood='ok']")).to_be_focused()
        expect(prak.locator(".weather__tile[data-mood='ok']")).to_have_attribute("aria-checked", "true")
        no_storage()

    run.check("Check-in: phrase, ≤3 steps, louder routing, help first for «очень тяжело», arrows", checkin, prak)

    print("Breathing")

    def breathing():
        show_panel(prak, "dyhanie")
        prak.locator("[data-breath-patterns] [data-pattern='478']").click()
        expect(prak.locator("[data-breath-count]")).to_have_text("Вдох 4 — пауза 7 — выдох 8")
        prak.locator("[data-breath-start]").click()
        expect(prak.locator("[data-breath-phase]")).to_contain_text("Вдох")
        expect(prak.locator("[data-breath-count]")).to_have_text("круг 1 из 3")
        expect(prak.locator("[data-breath-stop]")).to_be_visible()
        prak.locator("[data-breath-start]").click()
        expect(prak.locator("[data-breath-phase]")).to_have_text("На паузе")
        prak.locator("[data-breath-stop]").click()
        expect(prak.locator("[data-breath-done]")).to_be_visible()
        expect(prak.locator("[data-breath-done-phrase]")).to_contain_text("остановились")
        prak.locator("[data-breath-done] [data-action='helped']").click()
        expect(prak.locator("[data-helped-note]").first).to_contain_text("включи память")
        prak.locator("[data-breath-patterns] [data-pattern='custom']").click()
        prak.locator("[data-step='in'][data-delta='1']").click()
        expect(prak.locator("[data-custom-in]")).to_have_text("5 с")
        no_storage()

    run.check("Breathing: rhythms, start, pause, «Достаточно», done panel, own rhythm", breathing, prak)

    def breathe_action():
        prak.locator(".site-header .help-link").click()
        prak.locator("#sheet-help [data-action='breathe']").click()
        expect(prak.locator("#sheet-help")).to_be_hidden()
        expect(prak.locator("[data-breath-count]")).to_contain_text("круг 1 из", timeout=4000)
        prak.locator("[data-breath-stop]").click()

    run.check("Breathe action from the help sheet on the practices page closes it and starts 3–6", breathe_action, prak)

    print("Practices")

    def grounding():
        show_panel(prak, "polka")
        prak.locator("[data-shelf-item='grounding'] .shelf-item__open").click()
        expect(prak.locator("#sheet-room")).to_be_visible()
        expect(prak.locator("[data-room-progress]")).to_have_text("Шаг 1 из 5")
        expect(prak.locator(".ground__dot")).to_have_count(5)
        prak.locator(".ground__dot").first.click()
        expect(prak.locator(".ground__dot").first).to_have_attribute("aria-pressed", "true")
        prak.keyboard.press("ArrowRight")
        expect(prak.locator(".ground__dot")).to_have_count(4)
        for _ in range(4):
            prak.locator(".room__nav .btn--primary").click()
        expect(prak.locator("[data-room-body]")).to_contain_text("Ты здесь.")
        prak.locator("[data-room-enough]").click()
        expect(prak.locator("#sheet-room")).to_be_hidden()

    run.check("Room 5-4-3-2-1: steps, dots, arrows, finish", grounding, prak)

    def feelings():
        show_panel(prak, "polka")
        prak.locator("[data-shelf-item='feelings'] .shelf-item__open").click()
        prak.locator("[data-zone-chip='chest']").click()
        prak.locator(".room__nav .btn--primary").click()
        prak.locator(".feel-pairs .seg").nth(0).locator("button").nth(0).click()
        prak.locator(".room__nav .btn--primary").click()
        prak.locator(".bubble-chip").nth(1).click()
        prak.locator(".room__nav .btn--primary").click()
        expect(prak.locator(".heard-card")).to_contain_text("Я услышала себя: в груди — тёплое. Оно говорит: «мне тревожно».")
        prak.locator("[data-room-enough]").click()

    run.check("Room «Контакт с чувствами»: body zone, pair, voice, final card", feelings, prak)

    def envelope():
        show_panel(prak, "polka")
        prak.locator("[data-shelf-item='envelope'] .shelf-item__open").click()
        prak.locator(".envelope__field").fill("не успеваю ничего")
        prak.locator(".room__actions .btn--ghost").click()
        expect(prak.locator(".room__note")).to_contain_text("включи память")
        prak.locator(".room__actions .btn--primary").click()
        expect(prak.locator(".room__lead-big")).to_contain_text("Я вижу эти мысли", timeout=4000)
        prak.locator("[data-room-enough]").click()
        no_storage()

    run.check("Room «Отложить мысли до утра»: no envelope without memory, let go", envelope, prak)

    def choose():
        show_panel(prak, "polka")
        prak.locator("[data-shelf-item='choose'] .shelf-item__open").click()
        prak.wait_for_function("document.getElementById('sheet-room').open || document.querySelector('[data-breath-stop]:not([hidden])')", timeout=5000)
        prak.evaluate("document.querySelectorAll('dialog[open]').forEach(d => d.close())")
        if prak.locator("[data-breath-stop]").is_visible():
            prak.locator("[data-breath-stop]").click()

    run.check("«Выбери за меня» opens a practice", choose, prak)

    print("Thought record and traps")

    def thought():
        show_panel(prak, "razbor")
        prak.locator("#situation-text").fill("после разговора с мамой")
        prak.locator(".notebook__nav .btn--primary").click()
        prak.locator("#thought-text").fill("Все думают обо мне, что я должна справляться сама")
        expect(prak.locator("#thought-trap")).to_contain_text("Похоже на ловушку", timeout=3000)
        marks = prak.eval_on_selector_all(".thought-field__mirror mark", "ms => ms.map(m => m.textContent)")
        assert "должна" in marks and "думают обо мне" in marks, marks
        prak.locator(".notebook__nav .btn--primary").click()
        prak.locator(".notebook .chip", has_text="тревога").click()
        prak.locator(".strength__range").fill("9")
        expect(prak.locator(".strength__range")).to_have_attribute("aria-valuetext", "невыносимо")
        prak.locator(".notebook__nav .btn--primary").click()
        expect(prak.locator(".notebook__safety")).to_contain_text("лучше не оставаться одной")
        prak.locator(".notebook__nav .btn--ghost").click()
        prak.locator(".strength__range").fill("6")
        prak.locator(".notebook__nav .btn--primary").click()
        for _ in range(2):
            prak.locator(".notebook__nav .btn--primary").click()
        prak.locator("[data-thought-page] textarea").fill("Мне можно просить помощи")
        prak.locator(".notebook__nav .btn--primary").click()
        prak.locator(".strength__range").fill("6")
        prak.locator(".notebook__nav .btn--primary").click()
        expect(prak.locator(".notebook__outcome")).to_contain_text("это тоже нормально")
        expect(prak.locator(".notebook__new")).to_have_text("«Мне можно просить помощи»")
        assert not re.search(r"\b\d+/10\b", prak.locator("[data-thought-page]").inner_text())
        prak.locator("text=Разобрать другую мысль").click()
        expect(prak.locator("#situation-text")).to_have_value("")
        no_storage()

    run.check("Thought record: trap underline, safety branch, reframe, words not numbers", thought, prak)

    def traps():
        show_panel(prak, "razbor")
        expect(prak.locator(".trap")).to_have_count(12)
        prak.locator(".trap").first.click()
        expect(prak.locator(".trap").first).to_have_attribute("aria-pressed", "true")
        prak.locator("[data-trap-game] .chip").first.click()
        expect(prak.locator(".trap-game__feedback")).not_to_be_empty()

    run.check("Twelve trap cards turn over; the game answers", traps, prak)

    print("Words")

    def words():
        show_panel(prak, "slova")
        prak.locator("#w-tab-partner").click()
        expect(prak.locator("#w-partner")).to_be_visible()
        expect(prak.locator("#w-family")).to_be_hidden()
        prak.locator("#w-partner .phrase").first.get_by_text("Скопировать").click()
        assert prak.evaluate("navigator.clipboard.readText()").startswith("Пожалуйста, возьми коляску")
        prak.locator("#w-tab-advice").click()
        prak.locator("#w-advice .seg--tiny button", has_text="твёрже").click()
        expect(prak.locator("#w-advice .phrase p").first).to_contain_text("Эту тему я закрываю")
        prak.locator("#w-tab-own").click()
        prak.locator(".builder__presets .link", has_text="Советы родных").click()
        expect(prak.locator(".builder__result")).to_contain_text("Когда мне дают советы")
        prak.locator("#w-tab-partner").click()
        prak.locator("#w-partner .phrase").nth(1).get_by_text("Переделать под себя").click()
        expect(prak.locator("#w-own")).to_be_visible()
        expect(prak.locator(".builder__edit")).to_have_value(re.compile("^Я тревожусь"))

    run.check("Words: tabs, copy, softer/firmer, builder presets, rework", words, prak)

    print("Deck and bot")

    def deck():
        show_panel(prak, "opory")
        prak.locator(".deck__draw").click()
        expect(prak.locator(".deck-card__text")).not_to_be_empty()
        first = prak.locator(".deck-card__text").text_content()
        prak.locator(".deck__draw").click()
        prak.wait_for_timeout(500)
        assert prak.locator(".deck-card__text").text_content() != first
        prak.get_by_text("Оставить себе").click()
        expect(prak.locator(".deck__note")).to_contain_text("включи память")
        no_storage()

    run.check("Deck: draw, no immediate repeat, keep needs memory", deck, prak)

    def bot():
        expect(prak.locator("[data-bot-greeting]")).not_to_be_empty()
        expect(prak.locator("#bot .karman__honest")).to_contain_text("ИИ-ассистент в духе моего подхода — не я и не врач")
        expect(prak.locator(".bubble.is-waiting")).to_have_count(0)

    run.check("Bot demo: honest line, bubbles visible with reduced motion", bot, prak)

    print("Between the pages")

    def cross_page():
        # «Обсудить с Ириной» inside a practice opens the letter on the main page.
        other = open_page(context, run, "/praktiki.html")
        other.locator("#sheet-stop [data-action='write']").evaluate("b => b.click()")
        other.wait_for_url(re.compile(r"/(#vstrecha)?$"), timeout=6000)
        other.wait_for_selector("html[data-features='ready']")
        other.wait_for_function("location.hash === '#vstrecha'", timeout=6000)
        top = other.evaluate("document.getElementById('vstrecha').getBoundingClientRect().top")
        assert -10 < top < 160, top
        # «Подышать» from the help sheet on the main page opens the breathing tab on the practices page.
        other.locator(".site-header .help-link").click()
        other.locator("#sheet-help a[href='praktiki.html#dyhanie']").click()
        other.wait_for_url(re.compile(r"praktiki\.html"), timeout=6000)
        other.wait_for_selector("html[data-features='ready']")
        expect(other.locator(".ptab[aria-controls='dyhanie']")).to_have_attribute("aria-selected", "true", timeout=4000)
        expect(other.locator("#dyhanie")).to_be_visible()
        other.close()

    run.check("Between the pages: «Записаться» from a practice lands on the letter, «Подышать» opens the breathing tab", cross_page)

    print("Light by default, no night band, nothing that keeps moving")

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

    moving = new_context(browser, run, reduced_motion="no-preference")

    def still():
        # An anxious visitor reads worse when something keeps moving: no running lines, no spinning badge, no floating phone.
        main = open_page(moving, run, "/?tod=day")
        expect(main.locator(".marquee")).to_have_count(0)
        main.wait_for_timeout(3600)  # past the first-screen intro
        spin = main.locator(".orbit-badge__ring").evaluate("e => getComputedStyle(e).animationName")
        assert spin == "none", spin
        loops = main.evaluate("() => document.getAnimations().filter(a => a.effect && a.effect.getComputedTiming().iterations === Infinity).map(a => a.animationName || a.constructor.name)")
        assert not loops, loops
        main.close()
        other = open_page(moving, run, "/praktiki.html?tod=day")
        float_ = other.locator(".phone__screen").evaluate("e => getComputedStyle(e).animationName")
        assert float_ == "none", float_
        other.close()

    run.check("Nothing keeps moving: no running line, the badge and the bot phone hold still", still)

    print("Copy budget, single messages, photos")

    fresh = new_context(browser, run, reduced_motion="reduce")
    day = open_page(fresh, run, "/?tod=day")

    # Words a visitor sees without clicking: visible text nodes only, aria-hidden running heads
    # and screen-reader-only text left out. A word is a token with a letter or digit.
    words_js = r"""sel => {
        const root = document.querySelector(sel);
        if (!root) return -1;
        const skip = "[aria-hidden='true'], .visually-hidden";
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let count = 0;
        while (walker.nextNode()) {
            const parent = walker.currentNode.parentElement;
            if (!parent || parent.closest(skip) || !parent.checkVisibility({ checkVisibilityCSS: true })) continue;
            count += walker.currentNode.textContent.split(/\s+/).filter(t => /[\p{L}\p{N}]/u.test(t)).length;
        }
        return count;
    }"""

    # The whole text of the page outside the sheets, closed answers included.
    page_text = """() => {
        const parts = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            const parent = walker.currentNode.parentElement;
            if (!parent || parent.closest('dialog, script, style, noscript, svg')) continue;
            parts.push(walker.currentNode.textContent);
        }
        return parts.join(' ').replace(/\\s+/g, ' ');
    }"""

    def visible_child_photos(p):
        return p.eval_on_selector_all("[data-child-photo]", "els => els.filter(e => e.checkVisibility()).map(e => e.outerHTML.slice(0, 90))")

    def copy_budget():
        # One message, one place: each of these thoughts appears once on the main page.
        text = day.evaluate(page_text).lower()
        once = {
            "не экстренная служба": r"не экстренн",
            "не ставлю диагнозы": r"диагноз\w* не ставлю|не ставлю диагноз",
            "сайт ничего не хранит": r"cookies|ничего не (хранит|сохраня)|на (твоём|этом) устройстве",
            "готовый запрос": r"готовый запрос",
            "конфиденциально": r"конфиденциально(?!сть)",
            "не уверена — напиши": r"не уверена",
        }
        counts = {name: len(re.findall(pattern, text)) for name, pattern in once.items()}
        assert all(n == 1 for n in counts.values()), counts
        assert text.count("4 000 ₽") == 2, text.count("4 000 ₽")  # the first screen and the price card
        expect(day.locator("main .page-turn, main .next-line")).to_have_count(0)
        faq = day.locator("#voprosy details")
        expect(faq).to_have_count(9)
        expect(faq.first).to_have_attribute("open", "")
        expect(faq.last).to_have_attribute("data-faq-item", "night")
        expect(day.locator(".marquee, .calm-card, .calm-row, .formats, .prep, .facts, .okno__caption, .podhod__never, .docs__sub, .svet__honest")).to_have_count(0)
        expect(day.locator("#dveri .unsure")).to_have_count(1)

        # Photos without a stage: the neutral ones show, every child photo stays hidden.
        assert day.locator("[data-child-photo]").count() > 0
        assert visible_child_photos(day) == [], visible_child_photos(day)

        # The mother-and-baby photo shows only next to the pregnancy and postpartum chapters.
        baby = open_page(fresh, run, "/?stage=postpartum&tod=day")
        expect(baby.locator(".dveri__arch")).to_be_visible()
        baby.locator("#door-tab-loss").click()
        expect(baby.locator(".dveri__arch")).to_be_hidden()
        baby.locator("#door-tab-planning").click()
        expect(baby.locator(".dveri__arch")).to_be_hidden()
        baby.close()

        # Loss: no child photos on either page.
        for path in ["/?stage=loss&tod=day", "/praktiki.html?stage=loss&tod=day"]:
            loss = open_page(fresh, run, path)
            assert visible_child_photos(loss) == [], (path, visible_child_photos(loss))
            loss.close()

        # Word budget per spread, so the copy does not grow back.
        budget = {
            "#okno .okno__copy": 70,
            "#dveri .spread__page--l": 90,
            "#irina": 150,
            "#stoimost": 130,
            "#vstrecha .spread__page--l": 55,
        }
        counts = {sel: day.evaluate(words_js, sel) for sel in budget}
        for door in ["planning", "pregnancy", "postpartum", "loss", "close"]:
            day.locator(f"#door-tab-{door}").click()
            expect(day.locator(f"#door-{door}")).to_be_visible()
            budget[f"#door-{door}"] = 80
            counts[f"#door-{door}"] = day.evaluate(words_js, f"#door-{door}")
        over = {sel: (counts[sel], limit) for sel, limit in budget.items() if not 0 < counts[sel] <= limit}
        assert not over, (over, counts)
        # The whole main page stays short: what a visitor reads without opening anything (about 780 words;
        # before the practices moved out it was about twice as long).
        total = day.evaluate(words_js, "body")
        assert total <= 860, total

    run.check("Copy budget: each message once, short spreads, photos by stage", copy_budget, day)

    run.check("No cookies or storage were written during the whole visit", no_storage, page)
