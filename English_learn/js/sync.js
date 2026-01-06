// js/sync.js — 匿名跨裝置同步（使用 deviceId 代碼）
import { getAllWords, saveAllWords } from "./storage.js";

const SUPABASE_URL = "https://odgvzpphbtmgnvobalfz.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZ3Z6cHBoYnRtZ252b2JhbGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5NzY0OTAsImV4cCI6MjA3MjU1MjQ5MH0.HJg8dom4LkF7NaFYrM0oobDaBgcMvv-tWpt_-MCzJ7k";

if (!window.supabase) {
  console.error("[Sync] Supabase SDK 未載入，請確認 index.html 有引入 CDN。");
}

export const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON
);

let deviceId = localStorage.getItem("deviceId");
if (!deviceId) {
  deviceId = crypto.randomUUID();
  localStorage.setItem("deviceId", deviceId);
  console.log("[Sync] 建立新代碼：", deviceId);
}

let pushTimer = null;
function $(id){ return document.getElementById(id); }

/* ===== 雲端同步功能 ===== */
export async function pullFromCloud(){
  const { data, error } = await supabase
    .from("words")
    .select("word,data,updated_at")
    .eq("user_id", deviceId)
    .order("updated_at",{ascending:true});
  if (error) { console.error(error); return; }
  const local = getAllWords(); const byKey = new Map(local.map(o=>[o.word.toLowerCase(), o]));
  for (const row of data){
    const k = (row.word||"").toLowerCase();
    const cloudObj = row.data || {};
    const cloudTs = new Date(row.updated_at).getTime();
    const localTs = new Date(byKey.get(k)?.updatedAt || byKey.get(k)?.addedAt || 0).getTime();
    if (!byKey.has(k) || cloudTs >= localTs){
      byKey.set(k, { ...cloudObj });
    }
  }
  saveAllWords(Array.from(byKey.values()));
}

export async function pushToCloud(){
  const all = getAllWords();
  if (!all.length) return;
  const rows = all.map(o => ({
    user_id: deviceId,
    word: String(o.word || "").toLowerCase(),
    data: { ...o },
    updated_at: new Date().toISOString()
  }));
  const { error } = await supabase.from("words").upsert(rows, { onConflict: "user_id,word" });
  if (error) console.error(error);
}

export function schedulePush(ms = 1000){
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { pushToCloud(); }, ms);
}

/* ===== UI 控制：設定代碼 ===== */
function openSyncModal(){
  $("syncModal")?.classList.remove("hidden");
  $("syncModal")?.classList.add("flex");
  $("syncCodeCurrent").value = deviceId;
}

function closeSyncModal(){
  $("syncModal")?.classList.add("hidden");
  $("syncModal")?.classList.remove("flex");
}

function saveNewCode(){
  const newCode = $("syncCodeInput").value.trim();
  if (!newCode) return alert("請輸入代碼");
  localStorage.setItem("deviceId", newCode);
  deviceId = newCode;
  $("syncCodeCurrent").value = newCode;
  alert("已切換同步代碼，資料將自動重新同步。");
  closeSyncModal();
  pullFromCloud();
}

window.addEventListener("DOMContentLoaded", () => {
  $("btnSyncSettings")?.addEventListener("click", openSyncModal);
  $("syncClose")?.addEventListener("click", closeSyncModal);
  $("syncSave")?.addEventListener("click", saveNewCode);
});

window.Sync = { schedulePush, pushToCloud, pullFromCloud };
pullFromCloud();
