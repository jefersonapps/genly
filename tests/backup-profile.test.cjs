const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSourceLoader } = require('./load-source.cjs');

function fixture(initialSettings = [], initialFiles = []) {
  const tables = Object.fromEntries(['tasks', 'media', 'settings', 'groups', 'transactions'].map(name => [name, { name, key: 'key' }]));
  const rows = Object.fromEntries(Object.keys(tables).map(name => [name, []]));
  rows.settings = initialSettings;
  const files = new Map(initialFiles);
  const archives = new Map();
  let photoSequence = 0;
  const copyFile = async (from, to) => {
    if (!files.has(from)) throw new Error(`Missing file: ${from}`);
    files.set(to, files.get(from));
  };
  const db = {
    select: () => ({ from: table => ({ all: () => rows[table.name] }) }),
    delete: async table => { rows[table.name] = []; },
    insert: table => ({ values: value => ({
      onConflictDoUpdate: async () => { rows[table.name].push(value); },
    }) }),
  };
  const service = createSourceLoader({
    'expo-document-picker': {},
    'expo-file-system/legacy': {
      getInfoAsync: async uri => ({ exists: files.has(uri), isDirectory: false }),
      writeAsStringAsync: async (uri, content) => { files.set(uri, content); },
      readAsStringAsync: async uri => {
        if (!files.has(uri)) throw new Error(`Missing file: ${uri}`);
        return files.get(uri);
      },
      deleteAsync: async uri => {
        for (const path of files.keys()) if (path === uri || path.startsWith(uri)) files.delete(path);
      },
    },
    'react-native-zip-archive': {
      zip: async (source, target) => {
        const root = `file://${source}/`;
        archives.set(`file://${target}`, new Map([...files].filter(([path]) => path.startsWith(root)).map(([path, content]) => [path.slice(root.length), content])));
        return target;
      },
      unzip: async (source, target) => {
        const root = `file://${target.replace(/\/$/, '')}/`;
        for (const [path, content] of archives.get(`file://${source}`)) files.set(`${root}${path}`, content);
      },
    },
    '../db/client': { db },
    '../db/schema': tables,
    '../utils/file': {
      ensureDir: async () => {}, ensureDirectories: async () => {},
      getCacheDir: () => 'file:///cache/', getMediaDir: () => 'file:///new-install/media/',
      copyFile,
      copyToProfileDir: async source => {
        const destination = `file:///new-install/profile/avatar-${++photoSequence}.jpg`;
        await copyFile(source, destination);
        return destination;
      },
    },
  })('src/services/backupService.ts');
  return { ...service, rows, files, archives };
}

const oldPhoto = 'file:///old-install/profile/profile_avatar_123.jpg';
const profile = [
  { key: 'profile_name', value: 'Ana' },
  { key: 'profile_image', value: oldPhoto },
  { key: 'theme_mode', value: 'dark' },
];

test('ZIP export and restore preserve profile photo bytes on a different installation', async () => {
  const f = fixture(profile, [[oldPhoto, 'photo bytes']]);
  const archive = await f.exportBackup();
  assert.equal(f.archives.get(archive).get('media/profile_avatar_123.jpg'), 'photo bytes');
  f.files.delete(oldPhoto);
  await f.importBackup(archive);
  const settings = Object.fromEntries(f.rows.settings.map(row => [row.key, row.value]));
  assert.equal(settings.profile_name, 'Ana');
  assert.equal(settings.theme_mode, 'dark');
  assert.match(settings.profile_image, /^file:\/\/\/new-install\/profile\//);
  assert.equal(f.files.get(settings.profile_image), 'photo bytes');
  assert.ok(![...f.files.keys()].some(path => path.includes('unzip_import_')));
});

test('older ZIP without a photo clears the broken path and preserves other profile settings', async () => {
  const f = fixture(profile);
  const archive = await f.exportBackup();
  await f.importBackup(archive);
  assert.equal(f.rows.settings.find(row => row.key === 'profile_image').value, '');
  assert.equal(f.rows.settings.find(row => row.key === 'profile_name').value, 'Ana');
});

test('older ZIP can recover a profile photo still available on the device', async () => {
  const f = fixture(profile);
  const archive = await f.exportBackup();
  f.files.set(oldPhoto, 'existing photo');
  await f.importBackup(archive);
  const restored = f.rows.settings.find(row => row.key === 'profile_image').value;
  assert.equal(f.files.get(restored), 'existing photo');
  assert.notEqual(restored, oldPhoto);
});

for (const exists of [false, true]) {
  test(`legacy JSON restores profile settings with ${exists ? 'an available' : 'a missing'} photo`, async () => {
    const f = fixture([], exists ? [[oldPhoto, 'legacy photo']] : []);
    f.files.set('file:///legacy.json', JSON.stringify({ version: 1, tasks: [], settings: profile }));
    await f.importBackup('file:///legacy.json');
    const restored = f.rows.settings.find(row => row.key === 'profile_image').value;
    assert.equal(f.rows.settings.find(row => row.key === 'profile_name').value, 'Ana');
    if (exists) assert.equal(f.files.get(restored), 'legacy photo');
    else assert.equal(restored, '');
  });
}

test('empty and embedded profile images remain valid without an external file', async () => {
  for (const value of ['', 'data:image/png;base64,cGhvdG8=']) {
    const f = fixture([{ key: 'profile_image', value }]);
    await f.importBackup(await f.exportBackup());
    assert.equal(f.rows.settings[0].value, value);
  }
});
