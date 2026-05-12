import { supabase } from "../supabase";
import { normalizeTimersState, type TimersState } from "./types";

const LS_KEY = "timers.state";

function readLocal(): TimersState | null {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return null;
  try {
    return normalizeTimersState(JSON.parse(raw) as Partial<TimersState>);
  } catch {
    return null;
  }
}

function writeLocal(state: TimersState): void {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

async function fetchRemote(userId: string): Promise<TimersState | null> {
  const { data, error } = await supabase
    .from("timers_state")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.state) return null;
  return normalizeTimersState(data.state as Partial<TimersState>);
}

async function upsertRemote(userId: string, state: TimersState): Promise<void> {
  const { error } = await supabase
    .from("timers_state")
    .upsert({ user_id: userId, state, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// On first sign-in (remote empty) migrate any local state up, then clear local.
export async function loadTimersState(userId: string | null): Promise<TimersState | null> {
  if (!userId) return readLocal();
  const remote = await fetchRemote(userId);
  if (remote) return remote;
  const local = readLocal();
  if (!local) return null;
  await upsertRemote(userId, local);
  localStorage.removeItem(LS_KEY);
  return local;
}

export async function saveTimersState(userId: string | null, state: TimersState): Promise<void> {
  if (!userId) {
    writeLocal(state);
    return;
  }
  await upsertRemote(userId, state);
}

export async function wipeTimersState(userId: string | null): Promise<void> {
  if (!userId) {
    localStorage.removeItem(LS_KEY);
    return;
  }
  const { error } = await supabase.from("timers_state").delete().eq("user_id", userId);
  if (error) throw error;
}
