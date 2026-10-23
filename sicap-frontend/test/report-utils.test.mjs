import test from 'node:test';
import assert from 'node:assert/strict';
import { guatemalaDay, inReportPeriod, sumMoney, csvContent } from '../src/lib/reportUtils.ts';

test('timestamp days follow Guatemala midnight rather than UTC', () => {
  assert.equal(guatemalaDay('2026-10-18T05:59:59.999Z'), '2026-10-17');
  assert.equal(guatemalaDay('2026-10-18T06:00:00.000Z'), '2026-10-18');
});

test('includes both limits of a timestamp period in Guatemala', () => {
  const period = { from: '2026-10-17', to: '2026-10-17' };
  assert.equal(inReportPeriod('2026-10-17T05:59:59.999Z', period), false);
  assert.equal(inReportPeriod('2026-10-17T06:00:00.000Z', period), true);
  assert.equal(inReportPeriod('2026-10-18T05:59:59.999Z', period), true);
  assert.equal(inReportPeriod('2026-10-18T06:00:00.000Z', period), false);
});

test('DATE fields keep their calendar day without a timezone shift', () => {
  assert.equal(inReportPeriod('2026-10-17T00:00:00.000Z', { from: '2026-10-17', to: '2026-10-17' }, true), true);
});

test('supports open periods and the full history', () => {
  assert.equal(inReportPeriod('2026-10-17T12:00:00Z', { from: '', to: '' }), true);
  assert.equal(inReportPeriod('2026-10-17T12:00:00Z', { from: '2026-10-18', to: '' }), false);
  assert.equal(inReportPeriod('2026-10-17T12:00:00Z', { from: '', to: '2026-10-16' }), false);
});

test('sums decimal money in cents and preserves negative balances', () => {
  assert.equal(sumMoney(['0.10', 0.2]), 0.3);
  assert.equal(sumMoney([0.3, -0.4]), -0.1);
  assert.equal(sumMoney([]), 0);
});

test('CSV quotes separators, newlines and quotes and preserves UTF-8 names', () => {
  const csv = csvContent(['Nombre', 'Monto'], [['José; "Cliente"\nDos', 2.5]]);
  assert.equal(csv, '\uFEFF"Nombre";"Monto"\r\n"José; ""Cliente""\nDos";"2.5"');
});

test('CSV keeps user-supplied spreadsheet formulas as text without changing numeric amounts', () => {
  const csv = csvContent(['Nombre', 'Saldo'], [[' =1+1', -2.5], ['@SUM(A1)', 1]]);
  assert.equal(csv.includes('"\' =1+1";"-2.5"'), true);
  assert.equal(csv.includes('"\'@SUM(A1)";"1"'), true);
});
