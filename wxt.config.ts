import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Tab Caretaker',
    description:
      'Automatically organize duplicate and inactive tabs, with safe local archiving.',
    minimum_chrome_version: '121',
    permissions: [
      'alarms',
      'contextMenus',
      'notifications',
      'storage',
      'tabGroups',
      'tabs',
      'webNavigation',
    ],
    action: {
      default_title: 'Tab Caretaker',
    },
  },
});
