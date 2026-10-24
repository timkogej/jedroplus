import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectPortalEmailRecipientIds } from '../lib/portalAnnouncementRecipients.ts';

const row = (id, email, consent, optedOut = null) => ({
  id, 'Email stranke': email, marketing_consent: consent, marketing_opt_out_at: optedOut,
});

test('email goes only to consenting customers and respects opt-outs', () => {
  const rows = [row(1, 'yes@example.com', true), row(2, 'no@example.com', false),
    row(3, 'gone@example.com', true, '2026-10-20T10:00:00Z'), row(4, 'unknown@example.com', null)];
  assert.deepEqual(selectPortalEmailRecipientIds(rows, null), [1]);
});

test('same mailbox receives one email and target matching is exact', () => {
  const rows = [row(1, 'A@example.com', true), row(2, 'a@example.com', true), row(3, 'ab@example.com', true)];
  assert.deepEqual(selectPortalEmailRecipientIds(rows, null), [1, 3]);
  assert.deepEqual(selectPortalEmailRecipientIds(rows, 'a@example.com'), [1]);
});

test('a duplicate customer record with no consent blocks that mailbox', () => {
  const rows = [row(1, 'same@example.com', true), row(2, 'SAME@example.com', false), row(3, 'other@example.com', true)];
  assert.deepEqual(selectPortalEmailRecipientIds(rows, null), [3]);
});
