// -----------------------------------------------------------------------------
// Data store selector
// -----------------------------------------------------------------------------
// If a Supabase key is configured in the environment, use the Postgres-backed
// store (bookings persist). Otherwise fall back to the in-memory store.
// Controllers require THIS file and await the calls, so both work the same way.
// -----------------------------------------------------------------------------
const useSupabase = !!process.env.SUPABASE_KEY;

// eslint-disable-next-line no-console
console.log(`[store] using ${useSupabase ? 'Supabase (persistent)' : 'in-memory (resets on restart)'}`);

module.exports = useSupabase
  ? require('./queueStore.supabase')
  : require('./queueStore');
