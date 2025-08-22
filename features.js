export function normalizeAddrs(arr) {
  return (arr || []).map(x => String(x || "").trim().toLowerCase()).filter(Boolean);
}
export function domainOf(email) {
  const m = String(email || "").match(/@([^> )]+)/);
  return m ? m[1].toLowerCase() : "";
}
export function detectOnBehalf(text) {
  const t = (text || "").toLowerCase();
  return [
    "i represent ", "we represent ",
    "on behalf of ", "representing ",
    "i manage ", "we manage "
  ].some(p => t.includes(p));
}
export function extractCreatorName(text) {
  const m = text.match(/represent\s+([A-Z][a-z]+)(?:\s+[A-Z][a-z]+)?/);
  return m ? m[1] : "";
}
export function guessBrandDomain(toAddrs = [], ccAddrs = []) {
  const all = normalizeAddrs([...toAddrs, ...ccAddrs]);
  const nonCU = all.map(domainOf).filter(d => d && d !== "cuagency.co");
  return nonCU[0] || "";
}
export function contentHash(s) {
  const str = String(s || "");
  let h = 0;
  for (let i=0; i<str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
  return String(h >>> 0);
}
