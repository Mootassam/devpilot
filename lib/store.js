'use strict';
// Settings + projects, saved in %APPDATA%\DevPilot\config.json (atomic writes, a broken file never stops the app).
const fs = require('fs');
const path = require('path');
const { readJson, writeAtomic, id } = require('./util');

const DEFAULTS = {
  version: 1,
  settings: { theme: 'dark', autoRestart: false, notifications: true, stopOnQuit: true, vscode: '' },
  projects: [],           // { id, path, name, favorite, parts: {<rel>: {script, pm, port}}, profiles: [{id,name,parts}], buttons: [{id,label,cmd,part}], added }
  lastProject: null,
};

class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'config.json');
    const d = readJson(this.file);
    this.data = d && typeof d === 'object' ? { ...DEFAULTS, ...d, settings: { ...DEFAULTS.settings, ...(d.settings || {}) } } : JSON.parse(JSON.stringify(DEFAULTS));
    if (!Array.isArray(this.data.projects)) this.data.projects = [];
    this.timer = null;
  }
  save(now = false) {
    clearTimeout(this.timer);
    const write = () => { try { writeAtomic(this.file, JSON.stringify(this.data, null, 2)); } catch (_) { /* next save retries */ } };
    if (now) write(); else this.timer = setTimeout(write, 300);
  }
  get settings() { return this.data.settings; }
  setSettings(patch) { Object.assign(this.data.settings, patch || {}); this.save(); return this.data.settings; }
  projects() { return this.data.projects; }
  project(pid) { return this.data.projects.find((p) => p.id === pid) || null; }
  addProject(dir, name) {
    const norm = path.resolve(dir);
    const have = this.data.projects.find((p) => path.resolve(p.path).toLowerCase() === norm.toLowerCase());
    if (have) return have;
    const p = { id: id(), path: norm, name: name || path.basename(norm), favorite: false, parts: {}, profiles: [], buttons: [], added: Date.now() };
    this.data.projects.push(p);
    this.save();
    return p;
  }
  updateProject(pid, patch) {
    const p = this.project(pid);
    if (!p) return null;
    for (const k of ['name', 'favorite', 'parts', 'profiles', 'buttons']) if (patch[k] !== undefined) p[k] = patch[k];
    this.save();
    return p;
  }
  removeProject(pid) { this.data.projects = this.data.projects.filter((p) => p.id !== pid); this.save(); }
}

module.exports = { Store };
