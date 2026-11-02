const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSourceLoader } = require('./load-source.cjs');
const { getReminderStatus } = createSourceLoader()('src/utils/reminderStatus.ts');
const now = new Date(2026, 10, 2, 12, 0);

test('statuses distinguish expired, today, tomorrow and upcoming reminders', () => {
  assert.equal(getReminderStatus('2026-11-02', '11:00', 0, now).label, 'Expirado');
  assert.equal(getReminderStatus('2026-11-02', '13:00', 0, now).label, 'Hoje');
  assert.equal(getReminderStatus('2026-11-03', '09:00', 0, now).label, 'Amanhã');
  assert.equal(getReminderStatus('2026-11-05', null, 0, now).label, 'Em 3 dias');
  assert.equal(getReminderStatus('2026-11-01', null, 1, now).label, 'Concluído');
});
test('tomorrow crosses month and year boundaries using local dates', () => {
  assert.equal(getReminderStatus('2027-01-01', '09:00', 0, new Date(2026, 11, 31, 23)).label, 'Amanhã');
  assert.equal(getReminderStatus('2026-12-01', null, 0, new Date(2026, 10, 30, 23)).label, 'Amanhã');
  assert.equal(getReminderStatus('invalid', null, 0, now), null);
  assert.equal(getReminderStatus(null, null, 0, now), null);
});
test('widget date labels keep the local calendar date rather than shifting to the previous day', () => {
  const { formatWidgetDate } = createSourceLoader()('src/widgets/theme.ts');
  assert.equal(formatWidgetDate('2026-11-03', '09:00'), '03/11 09:00');
  assert.equal(formatWidgetDate('2026-11-03', null), '03/11');
});
