/**
 * JSON-serializable value (wire / storage). Use with Effect `Schema` at boundaries
 * (`decodeUnknownSync`, `UnknownFromJsonString`) to narrow to domain types.
 */
export type Json = null | boolean | number | string | Json[] | { readonly [k: string]: Json };
