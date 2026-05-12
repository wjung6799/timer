import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

// Scheduled local notifications fire even when the app is killed. On web, all
// of these are no-ops — the in-page sound effects already handle that case.

const native = Capacitor.isNativePlatform();

let permissionPromise: Promise<boolean> | null = null;

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!native) return false;
  if (permissionPromise) return permissionPromise;
  permissionPromise = (async () => {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === "granted") return true;
    if (current.display === "denied") return false;
    const req = await LocalNotifications.requestPermissions();
    return req.display === "granted";
  })();
  return permissionPromise;
}

// Stable 31-bit positive int from a string. Local notifications require int IDs.
function hash31(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 0x7fffffff;
}

function budgetId(categoryId: string): number {
  return hash31(`budget:${categoryId}`);
}

function pomoId(categoryId: string): number {
  return hash31(`pomo:${categoryId}`);
}

async function scheduleAt(
  id: number,
  title: string,
  body: string,
  fireAtMs: number,
): Promise<void> {
  if (!native) return;
  if (fireAtMs <= Date.now() + 500) return; // don't fire in the immediate past
  const ok = await ensureNotificationPermission();
  if (!ok) return;
  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title,
        body,
        schedule: { at: new Date(fireAtMs) },
      },
    ],
  }).catch((e) => console.warn("schedule failed", e));
}

async function cancel(id: number): Promise<void> {
  if (!native) return;
  await LocalNotifications.cancel({
    notifications: [{ id }],
  }).catch(() => {});
}

export async function scheduleBudgetReached(
  categoryId: string,
  categoryName: string,
  fireAtMs: number,
): Promise<void> {
  await scheduleAt(
    budgetId(categoryId),
    "Budget reached",
    `${categoryName} hit its time budget.`,
    fireAtMs,
  );
}

export async function schedulePomoEnd(
  categoryId: string,
  categoryName: string,
  fireAtMs: number,
): Promise<void> {
  await scheduleAt(
    pomoId(categoryId),
    "Pomodoro complete",
    `${categoryName} block done.`,
    fireAtMs,
  );
}

// The Timers module runs one countdown at a time, so a single fixed id is fine.
const TIMER_NOTIF_ID = hash31("timers:active");

export async function scheduleTimerEnd(name: string, fireAtMs: number): Promise<void> {
  await scheduleAt(TIMER_NOTIF_ID, "Timer done", `${name} finished.`, fireAtMs);
}

export async function cancelTimerNotification(): Promise<void> {
  await cancel(TIMER_NOTIF_ID);
}

export async function cancelCategoryNotifications(categoryId: string): Promise<void> {
  await cancel(budgetId(categoryId));
  await cancel(pomoId(categoryId));
}

export async function cancelAllScheduled(): Promise<void> {
  if (!native) return;
  const pending = await LocalNotifications.getPending().catch(() => null);
  if (!pending || pending.notifications.length === 0) return;
  await LocalNotifications.cancel({
    notifications: pending.notifications.map((n) => ({ id: n.id })),
  }).catch(() => {});
}
