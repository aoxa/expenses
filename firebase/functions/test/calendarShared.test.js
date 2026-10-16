import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { addedMembers, buildSharedMessage, sendExpoPush } from '../src/calendarShared.js';

const calendar = {
  name: 'Casa',
  ownerId: 'owner',
  members: { owner: 'owner', ana: 'write', beto: 'read' },
  memberNames: { owner: 'Pedro', ana: 'Ana', beto: 'Beto' },
};

describe('addedMembers', () => {
  test('returns only uids that are new', () => {
    assert.deepEqual(addedMembers(['owner'], ['owner', 'ana', 'beto']), ['ana', 'beto']);
  });

  test('ignores permission changes and removals', () => {
    assert.deepEqual(addedMembers(['owner', 'ana'], ['owner', 'ana']), []);
    assert.deepEqual(addedMembers(['owner', 'ana'], ['owner']), []);
  });

  test('handles missing arrays', () => {
    assert.deepEqual(addedMembers(undefined, ['owner']), ['owner']);
  });
});

describe('buildSharedMessage', () => {
  test('mentions owner, calendar and permission, and links to the calendar', () => {
    const msg = buildSharedMessage({ token: 'ExponentPushToken[a]', calendarId: 'cal1', calendar, uid: 'ana' });
    assert.equal(msg.to, 'ExponentPushToken[a]');
    assert.equal(msg.title, 'Te compartieron un calendario');
    assert.equal(msg.body, 'Pedro compartió "Casa" con vos y puede ver y agregar gastos.');
    assert.deepEqual(msg.data, { type: 'calendar_shared', calendarId: 'cal1' });
    assert.equal(msg.channelId, 'default');
  });

  test('read-only wording', () => {
    const msg = buildSharedMessage({ token: 't', calendarId: 'cal1', calendar, uid: 'beto' });
    assert.equal(msg.body, 'Pedro compartió "Casa" con vos y puede ver los gastos.');
  });
});

describe('sendExpoPush', () => {
  const fakeFetch = (respond) => {
    const calls = [];
    const fn = async (url, init) => {
      const body = JSON.parse(init.body);
      calls.push({ url, init, body });
      return { ok: true, json: async () => ({ data: body.map(respond) }) };
    };
    return { fn, calls };
  };

  test('returns tokens reported as DeviceNotRegistered', async () => {
    const { fn } = fakeFetch((m) =>
      m.to === 'dead' ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok', id: 'x' },
    );
    const invalid = await sendExpoPush([{ to: 'alive' }, { to: 'dead' }], { fetchFn: fn });
    assert.deepEqual(invalid, ['dead']);
  });

  test('does not drop tokens for other errors', async () => {
    const { fn } = fakeFetch(() => ({ status: 'error', details: { error: 'MessageRateExceeded' } }));
    assert.deepEqual(await sendExpoPush([{ to: 'a' }], { fetchFn: fn }), []);
  });

  test('splits into batches of 100', async () => {
    const { fn, calls } = fakeFetch(() => ({ status: 'ok' }));
    const messages = Array.from({ length: 250 }, (_, i) => ({ to: `t${i}` }));
    await sendExpoPush(messages, { fetchFn: fn });
    assert.deepEqual(calls.map((c) => c.body.length), [100, 100, 50]);
  });

  test('sends the access token when configured', async () => {
    const { fn, calls } = fakeFetch(() => ({ status: 'ok' }));
    await sendExpoPush([{ to: 'a' }], { fetchFn: fn, accessToken: 'secret' });
    assert.equal(calls[0].init.headers.authorization, 'Bearer secret');
  });

  test('throws when the whole request fails', async () => {
    const fn = async () => ({ ok: false, status: 500, text: async () => 'boom' });
    await assert.rejects(sendExpoPush([{ to: 'a' }], { fetchFn: fn }), /500 boom/);
  });
});
