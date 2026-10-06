"""Shared helpers for the functional browser checks. No screenshots are taken.

Every check runs against the already running local preview (python server.py) and
blocks any request that leaves localhost: the site must work without the network.
"""
from __future__ import annotations

import glob
import json
import os
import sys
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import Error as PlaywrightError, sync_playwright

BASE = os.environ.get("SITE_URL", "http://localhost:3000")
HERE = Path(__file__).resolve().parent


def launch(p):
    """Use Playwright's own Chromium; fall back to a pre-installed one (CI containers)."""
    try:
        return p.chromium.launch(headless=True)
    except PlaywrightError:
        candidates = sorted(glob.glob("/opt/pw-browsers/chromium-*/chrome-linux/chrome"))
        path = os.environ.get("CHROMIUM_PATH") or (candidates[-1] if candidates else None)
        if not path:
            raise
        return p.chromium.launch(headless=True, executable_path=path)


class Run:
    def __init__(self, name: str):
        self.name = name
        self.checks: list[dict] = []
        self.errors: list[str] = []
        self.external: list[str] = []

    def check(self, title: str, fn, page=None):
        try:
            fn()
            self.checks.append({"name": title, "passed": True})
            print(f"  ok    {title}")
        except Exception as exc:  # noqa: BLE001 — report every failure, keep going
            self.checks.append({"name": title, "passed": False, "error": str(exc)[:600]})
            print(f"  FAIL  {title}\n        {str(exc).splitlines()[0][:300]}")
        if page is not None:
            page.evaluate("document.querySelectorAll('dialog[open]').forEach(d => d.close())")

    def finish(self) -> int:
        report = {"checks": self.checks, "page_errors": self.errors, "external_requests": self.external}
        (HERE / f"{self.name}-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        failed = [c for c in self.checks if not c["passed"]]
        print(f"\n{len(self.checks) - len(failed)}/{len(self.checks)} passed; page errors: {len(self.errors)}; external requests: {len(self.external)}")
        for error in self.errors:
            print("  page error:", error[:300])
        return 1 if failed or self.errors or self.external else 0


def new_context(browser, run: Run, **options):
    options.setdefault("viewport", {"width": 1440, "height": 1000})
    options.setdefault("locale", "ru-RU")
    context = browser.new_context(**options)
    try:
        context.grant_permissions(["clipboard-read", "clipboard-write"], origin=BASE)
    except PlaywrightError:
        pass

    def route(route_):
        host = urlparse(route_.request.url).hostname
        if host in {"localhost", "127.0.0.1"} or route_.request.url.startswith(("blob:", "data:")):
            route_.continue_()
            return
        # A navigation the visitor taps (Telegram, mail) is fine; anything fetched on its own is not.
        if not route_.request.is_navigation_request():
            run.external.append(route_.request.url)
        route_.abort()

    context.route("**/*", route)
    return context


def open_page(context, run: Run, path: str = "/"):
    page = context.new_page()
    page.on("pageerror", lambda error: run.errors.append(str(error)))
    page.on("console", lambda message: run.errors.append(f"console: {message.text}") if message.type == "error" else None)
    page.goto(BASE + path)
    page.wait_for_selector("html[data-features='ready']", timeout=10000)
    return page


def show_panel(page, panel_id: str):
    """Practices live in one block with tabs: open the tab that holds `panel_id` (no-op if open)."""
    page.evaluate("""id => {
        const panel = document.getElementById(id);
        const tab = document.querySelector(`[role="tab"][aria-controls="${id}"]`);
        if (panel && panel.hidden && tab) tab.click();
    }""", panel_id)


def storage(page):
    return page.evaluate("({ local: {...localStorage}, session: {...sessionStorage}, cookies: document.cookie })")


@contextmanager
def session(name: str):
    run = Run(name)
    with sync_playwright() as p:
        browser = launch(p)
        try:
            yield run, browser
        finally:
            browser.close()
    sys.exit(run.finish())
