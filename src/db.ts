import { supabase } from "./supabase";
import type { AppState, Category } from "./types";

export type DayHistoryRow = {
  date: string;
  categories: Category[];
};

const LS_STATE_KEY = "budget.state";
const LS_HISTORY_KEY = "budget.history";

function readLocalState(): AppState | null {
  const raw = localStorage.getItem(LS_STATE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AppState;
  } catch {
    return null;
  }
}

function writeLocalState(state: AppState): void {
  localStorage.setItem(LS_STATE_KEY, JSON.stringify(state));
}

function readLocalHistory(): DayHistoryRow[] {
  const raw = localStorage.getItem(LS_HISTORY_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as DayHistoryRow[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeLocalHistory(rows: DayHistoryRow[]): void {
  localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(rows));
}

async function fetchRemoteState(userId: string): Promise<AppState | null> {
  const { data, error } = await supabase
    .from("app_state")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.state as AppState | undefined) ?? null;
}

async function upsertRemoteState(userId: string, state: AppState): Promise<void> {
  const { error } = await supabase
    .from("app_state")
    .upsert({ user_id: userId, state, updated_at: new Date().toISOString() });
  if (error) throw error;
}

async function upsertRemoteDayHistory(
  userId: string,
  date: string,
  categories: Category[],
): Promise<void> {
  const { error } = await supabase
    .from("day_history")
    .upsert({ user_id: userId, date, categories });
  if (error) throw error;
}

async function listRemoteHistory(userId: string, limit = 60): Promise<DayHistoryRow[]> {
  const { data, error } = await supabase
    .from("day_history")
    .select("date, categories")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as DayHistoryRow[];
}

// Loads state for the given user. When userId is null, reads from localStorage.
// On first sign-in (remote empty), migrates local state + history up and clears local.
export async function loadState(userId: string | null): Promise<AppState | null> {
  if (!userId) return readLocalState();
  const remote = await fetchRemoteState(userId);
  if (remote) return remote;
  const localState = readLocalState();
  const localHistory = readLocalHistory();
  if (!localState && localHistory.length === 0) return null;
  if (localState) await upsertRemoteState(userId, localState);
  await Promise.all(
    localHistory.map((r) => upsertRemoteDayHistory(userId, r.date, r.categories)),
  );
  localStorage.removeItem(LS_STATE_KEY);
  localStorage.removeItem(LS_HISTORY_KEY);
  return localState;
}

export async function saveState(userId: string | null, state: AppState): Promise<void> {
  if (!userId) {
    writeLocalState(state);
    return;
  }
  await upsertRemoteState(userId, state);
}

export async function archiveDay(
  userId: string | null,
  date: string,
  categories: Category[],
): Promise<void> {
  if (!userId) {
    const all = readLocalHistory().filter((r) => r.date !== date);
    writeLocalHistory([{ date, categories }, ...all]);
    return;
  }
  await upsertRemoteDayHistory(userId, date, categories);
}

export async function loadHistory(
  userId: string | null,
  limit = 60,
): Promise<DayHistoryRow[]> {
  if (!userId) return readLocalHistory().slice(0, limit);
  return listRemoteHistory(userId, limit);
}
