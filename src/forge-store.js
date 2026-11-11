import { kvs, Filter, FilterConditions, Sort } from '@forge/kvs';
import { DomainError, identifier, text } from './domain.mjs';

const ENTITY = 'ww-record';
const TYPES = new Set(['waiver', 'job', 'reservation', 'audit', 'source-binding']);

function storageKey(type, id) {
  if (!TYPES.has(type)) throw new TypeError('Unsupported record type.');
  return `${type}#${identifier(id)}`;
}

function wrap(type, id, record) {
  if (record.id !== id || !Number.isSafeInteger(record.version) || record.version < 1 || record.version > 2147483647) {
    throw new DomainError('INVALID_RECORD', 'The record identifier or version is invalid.');
  }
  const value = {
    version: record.version,
    projectKey: text(record.projectKey, 'Project', 64),
    kind: type,
    updatedAt: text(record.updatedAt ?? record.at ?? record.createdAt, 'Record time', 64),
    record,
  };
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 200 * 1024) throw new DomainError('RECORD_TOO_LARGE', 'This record exceeds the supported size.');
  return value;
}

function condition(version) {
  if (version !== null && (!Number.isSafeInteger(version) || version < 1)) throw new TypeError('Invalid version condition.');
  return new Filter().and('version', version === null ? FilterConditions.notExists() : FilterConditions.equalTo(version));
}

/** Queries discover records only. The ledger always uses strictly consistent get
 * and one conditional transaction; it never adds up query results for balance.
 */
export function createForgeRepository(storage = kvs) {
  const entity = () => storage.entity(ENTITY);
  async function get(type, id) {
    const value = await entity().get(storageKey(type, id));
    if (!value) return null;
    if (value.kind !== type || value.record?.id !== id || value.version !== value.record?.version) {
      throw new DomainError('CORRUPT_LEDGER', 'Stored record metadata does not match its contents.');
    }
    return value.record;
  }
  return {
    get,
    async list(type, projectKey, { limit = 40, cursor } = {}) {
      if (!TYPES.has(type) || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new TypeError('Invalid discovery query.');
      let query = entity().query().index('by-project-kind', { partition: [text(projectKey, 'Project', 64), type] }).sort(Sort.DESC).limit(limit);
      if (cursor) query = query.cursor(cursor);
      const page = await query.getMany();
      // Re-read discovered keys because query values are eventually consistent.
      const records = await Promise.all(page.results.map(({ value }) => get(type, value.record.id)));
      return { records: records.filter(Boolean), nextCursor: page.nextCursor ?? null };
    },
    async compareAndSwapTransaction({ checks, writes }) {
      if (!Array.isArray(checks) || !Array.isArray(writes) || !writes.length) throw new TypeError('An atomic write set is required.');
      const expected = new Map();
      for (const check of checks) {
        const key = storageKey(check.type, check.id);
        if (expected.has(key)) throw new TypeError('Duplicate transaction check.');
        expected.set(key, { ...check, conditions: condition(check.version) });
      }
      const written = new Set();
      const tx = storage.transact();
      for (const write of writes) {
        const key = storageKey(write.type, write.id);
        const check = expected.get(key);
        if (!check || written.has(key)) throw new TypeError('Every unique write needs an explicit version check.');
        if (write.value.version !== (check.version ?? 0) + 1) throw new TypeError('Record versions must advance exactly once.');
        written.add(key);
        tx.set(key, wrap(write.type, write.id, write.value), { entityName: ENTITY, conditions: check.conditions });
      }
      for (const [key, check] of expected) {
        if (!written.has(key)) tx.check(key, { entityName: ENTITY, conditions: check.conditions });
      }
      if (expected.size > 25) throw new TypeError('Transaction exceeds the platform operation limit.');
      try {
        await tx.execute();
        return true;
      } catch (error) {
        // Do not guess undocumented provider error strings or turn outages into
        // success. A fresh read proves a CAS conflict (including a lost response
        // after our own commit); unchanged versions preserve the original error.
        const current = await Promise.all([...expected.values()].map(async (check) => ({ check, record: await get(check.type, check.id) })));
        if (current.some(({ check, record }) => (record?.version ?? null) !== check.version)) return false;
        throw error;
      }
    },
  };
}
