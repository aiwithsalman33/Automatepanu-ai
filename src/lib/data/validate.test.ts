import { describe, expect, it } from 'vitest';

import { DataRequestError, validateRequest, validateSelect } from './validate';

const bad = (fn: () => unknown, re?: RegExp) => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(DataRequestError);
    if (re) expect((e as Error).message).toMatch(re);
    return;
  }
  throw new Error('expected a DataRequestError');
};

describe('validateSelect', () => {
  it('accepts the selects the UI uses', () => {
    for (const [table, sel] of [
      ['contacts', '*'],
      ['conversations', '*, contact:contacts(*, contact_tags(tags(*)))'],
      [
        'deals',
        '*, contact:contacts(*), assignee:profiles!deals_assigned_to_fkey(*)',
      ],
      ['broadcast_recipients', '*, contact:contacts(*)'],
      ['contact_tags', 'id, tag_id, tags(*)'],
      ['whatsapp_config', 'id, status, verify_token, mirror_inbound_media'],
    ]) {
      expect(() => validateSelect(table, sel)).not.toThrow();
    }
  });

  it('refuses embeds the table does not list', () => {
    bad(() => validateSelect('contacts', '*, whatsapp_config(*)'), /Embedding/);
    bad(() => validateSelect('tags', '*, accounts(*)'), /Embedding/);
  });

  it('never exposes denied columns, directly or via *', () => {
    bad(() => validateSelect('whatsapp_config', '*'), /explicit/);
    bad(
      () => validateSelect('whatsapp_config', 'id, access_token'),
      /not readable/
    );
  });

  it('refuses anything that is not a plain identifier list', () => {
    for (const s of [
      'id::text',
      'count()',
      'id,name)',
      '...contacts(*)',
      'data->>x',
      'id; drop table x',
      'a'.repeat(500),
      'contact:contacts(contact:contacts(contact:contacts(contact:contacts(contact:contacts(*)))))',
    ]) {
      bad(() => validateSelect('conversations', s));
    }
  });
});

describe('validateRequest', () => {
  it('rejects unknown tables and operations', () => {
    bad(() => validateRequest('auth_users', { op: 'select' }), /Unknown table/);
    bad(() => validateRequest('__proto__', { op: 'select' }), /Unknown table/);
    bad(
      () =>
        validateRequest('messages', {
          op: 'delete',
          filters: [['eq', 'id', 'x']],
        }),
      /not allowed/
    );
    bad(
      () =>
        validateRequest('automations', { op: 'insert', values: { name: 'x' } }),
      /not allowed/
    );
  });

  it('defaults select to *', () => {
    expect(validateRequest('tags', { op: 'select' }).select).toBe('*');
  });

  it('refuses update/delete without a filter', () => {
    bad(() => validateRequest('tags', { op: 'delete' }), /needs a filter/);
    bad(
      () => validateRequest('tags', { op: 'update', values: { name: 'x' } }),
      /needs a filter/
    );
  });

  it('refuses tenant/protected columns and non-writable columns on update', () => {
    for (const col of ['account_id', 'user_id', 'created_at']) {
      bad(
        () =>
          validateRequest('tags', {
            op: 'update',
            values: { [col]: 'x' },
            filters: [['eq', 'id', '1']],
          }),
        /can't be changed/
      );
    }
    bad(
      () =>
        validateRequest('accounts', {
          op: 'update',
          values: { name: 'x' },
          filters: [['eq', 'id', '1']],
        }),
      /not writable/
    );
    bad(
      () =>
        validateRequest('whatsapp_config', {
          op: 'update',
          values: { access_token: 'x' },
          filters: [['eq', 'id', '1']],
        }),
      /not writable/
    );
    expect(
      validateRequest('accounts', {
        op: 'update',
        values: { default_currency: 'INR' },
        filters: [['eq', 'id', '1']],
      }).values
    ).toEqual({ default_currency: 'INR' });
  });

  it('validates filters', () => {
    bad(
      () =>
        validateRequest('tags', {
          op: 'select',
          filters: [['like', 'name', 'x']],
        }),
      /op/
    );
    bad(
      () =>
        validateRequest('tags', {
          op: 'select',
          filters: [['eq', 'name;--', 'x']],
        }),
      /column/
    );
    bad(
      () =>
        validateRequest('tags', {
          op: 'select',
          filters: [['eq', 'name', { a: 1 }]],
        }),
      /value/
    );
    bad(
      () =>
        validateRequest('tags', { op: 'select', filters: [['in', 'id', 'x']] }),
      /in\(\)/
    );
    bad(
      () =>
        validateRequest('tags', {
          op: 'select',
          filters: [['in', 'id', Array(1001).fill('x')]],
        }),
      /in\(\)/
    );
    bad(
      () =>
        validateRequest('tags', {
          op: 'select',
          filters: [['is', 'x', 'nope']],
        }),
      /is\(\)/
    );
    bad(
      () =>
        validateRequest('whatsapp_config', {
          op: 'select',
          select: 'id',
          filters: [['eq', 'access_token', 'x']],
        }),
      /column/
    );
    expect(
      validateRequest('tags', {
        op: 'select',
        filters: [
          ['eq', 'account_id', 'a'],
          ['in', 'id', ['1', '2']],
          ['is', 'deleted_at', null],
          ['ilikeAnyOf', 'name', ['a', 'b']],
        ],
      }).filters
    ).toHaveLength(4);
  });

  it('only allows search on tables that define it', () => {
    bad(
      () => validateRequest('tags', { op: 'select', search: { term: 'x' } }),
      /search/
    );
    expect(
      validateRequest('contacts', {
        op: 'select',
        search: { term: 'ann', includeEmail: true },
      }).search
    ).toEqual({
      term: 'ann',
      includeEmail: true,
    });
  });

  it('bounds range, limit and row counts', () => {
    bad(
      () => validateRequest('tags', { op: 'select', range: [10, 5] }),
      /range/
    );
    bad(
      () => validateRequest('tags', { op: 'select', range: [0, 10_000] }),
      /range/
    );
    bad(() => validateRequest('tags', { op: 'select', limit: -1 }), /limit/);
    bad(() => validateRequest('tags', { op: 'insert', values: [] }), /rows/);
    bad(
      () => validateRequest('tags', { op: 'insert', values: 'x' }),
      /objects/
    );
  });
});
