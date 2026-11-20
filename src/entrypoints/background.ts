import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { ALARMS, IS_E2E } from '../background/config';
import {
  dailyMaintenance,
  getChallenge,
  onIdleChange,
  scheduleAlarms,
  tick,
  unlock,
} from '../background/engine';
import { isRequest } from '../shared/messages';
import * as store from '../storage';

export default defineBackground({
  type: 'module',
  main() {
    // Listeners must be registered synchronously so events wake the worker.
    browser.tabs.onActivated.addListener(() => void tick('tab'));
    browser.tabs.onUpdated.addListener((_id, info) => {
      if (info.url || info.status === 'complete' || info.audible !== undefined) void tick('tab');
    });
    browser.tabs.onRemoved.addListener(() => void tick('tab'));
    browser.windows.onFocusChanged.addListener(() => void tick('window'));
    browser.idle.onStateChanged.addListener((state) => void onIdleChange(state));

    browser.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === ALARMS.reset) void dailyMaintenance().then(() => tick('alarm'));
      else if (alarm.name === ALARMS.heartbeat || alarm.name.startsWith(ALARMS.grace))
        void tick(alarm.name === ALARMS.heartbeat ? 'heartbeat' : 'alarm');
    });

    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if ('settings' in changes) void scheduleAlarms().then(() => tick('storage'));
      else if ('limits' in changes || 'grace' in changes) void tick('storage');
    });

    browser.runtime.onMessage.addListener((msg: unknown) => {
      if (!isRequest(msg)) return undefined;
      switch (msg.type) {
        case 'dwell:flush':
          return tick('message').then(() => ({ ok: true }));
        case 'dwell:challenge':
          return getChallenge(msg.limitId);
        case 'dwell:unlock':
          return unlock(msg.limitId, msg.typed);
      }
    });

    browser.notifications.onClicked.addListener((id) => {
      if (id.startsWith('dwell:')) void browser.runtime.openOptionsPage();
    });

    browser.runtime.onInstalled.addListener(async ({ reason }) => {
      await store.ensureSchema();
      await dailyMaintenance();
      if (reason === 'install' && !IS_E2E) {
        await browser.tabs.create({ url: browser.runtime.getURL('/options.html#/welcome') });
      }
    });
    browser.runtime.onStartup.addListener(() => void dailyMaintenance());

    void (async () => {
      await store.ensureSchema();
      await scheduleAlarms(); // also refreshes the idle state
      await tick('startup');
    })();

    if (IS_E2E) setInterval(() => void tick('heartbeat'), 1000);
  },
});
