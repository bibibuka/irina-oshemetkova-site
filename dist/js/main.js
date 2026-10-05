// Entry point: shared infrastructure first, then each feature on its own, so one
// failing feature never takes the others down.
import { initPrefs } from './core/prefs.js';
import { initSheets } from './core/sheets.js';
import { initActions } from './core/actions.js';
import { initReveals, initHeader, initSectionSpy, initKeyboardAwareDock } from './core/motion.js';

initPrefs();
initSheets();
initActions();
initHeader();
initSectionSpy();
initKeyboardAwareDock();
initReveals();

for (const name of ['site', 'booking', 'practices']) {
  import(`./features/${name}.js`)
    .then((feature) => feature.init?.())
    .catch((error) => console.error(`[feature:${name}]`, error));
}
