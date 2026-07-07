/** Every backend error is one of two shapes: AnavaException's
 * {error:{code,message}} (see main.py's exception handler), or FastAPI's
 * own 422 validation shape {detail: [{type,loc,msg,input}, ...]} — Pydantic
 * validation errors never go through the custom handler. Reading
 * `err.response.data.detail` and rendering it directly (a common pattern
 * across this app) crashes React the moment a 422 hits, since `detail` is
 * an array of objects there, not a string ("Objects are not valid as a
 * React child"). This always returns a plain string. */
export function extractErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data as
    | { error?: { message?: string }; detail?: unknown }
    | undefined;
  if (!data) return fallback;
  if (data.error?.message) return data.error.message;
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) {
    const msgs = data.detail
      .map((d) => (d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : null))
      .filter((m): m is string => !!m);
    if (msgs.length) return msgs.join("; ");
  }
  return fallback;
}
