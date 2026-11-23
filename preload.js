'use strict';
// The only bridge between the window and DevPilot's engine (the page itself has no access to files or programs).
const { contextBridge, ipcRenderer } = require('electron');

const call = (ch) => (...a) => ipcRenderer.invoke(ch, ...a).then((r) => { if (!r || !r.ok) throw new Error((r && r.error) || 'Something went wrong.'); return r.data; });
const CH = ['state', 'settings', 'pick-folder', 'pick-file', 'project-add', 'project-add-many', 'project-find', 'project-update', 'project-remove', 'project-open',
  'scan', 'part-set', 'run', 'stop', 'restart', 'start-all', 'stop-all', 'restart-all', 'install-all', 'custom', 'logs', 'logs-clear',
  'ports', 'port-who', 'kill', 'urls-find', 'urls-local', 'urls-prod', 'images-scan', 'images-trash', 'images-batches', 'images-restore', 'images-empty', 'images-shrink',
  'git-status', 'git-pull', 'git-checkout', 'open-code', 'open-folder', 'open-url', 'show-file', 'copy'];
const api = {};
for (const ch of CH) api[ch.replace(/-([a-z])/g, (m, c) => c.toUpperCase())] = call(ch);
const EVENTS = ['proc-state', 'proc-logs', 'toast', 'focus-logs', 'theme'];
api.on = (ev, fn) => { if (!EVENTS.includes(ev)) return () => {}; const h = (e, d) => fn(d); ipcRenderer.on(ev, h); return () => ipcRenderer.off(ev, h); };
contextBridge.exposeInMainWorld('dp', api);
