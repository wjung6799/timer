import { useMemo, useState } from "react";
import {
  type DefaultCategory,
  type Weekday,
  type WeekdayDefaults,
  WEEKDAY_LABELS,
  WEEKDAY_LABELS_LONG,
  builtInDefaults,
  cryptoId,
  fmtBudget,
  PALETTE,
  parseBudget,
  todayWeekday,
} from "./types";
import Confirm from "./Confirm";

type Action = "reset" | "clear" | "delete";
type Tab = "all" | Weekday;

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export default function Settings({
  defaults,
  weekdayDefaults,
  signedIn,
  onUpdateDefaults,
  onUpdateWeekdayDefaults,
  onResetToday,
  onClearAllData,
  onDeleteAccount,
}: {
  defaults: DefaultCategory[] | undefined;
  weekdayDefaults: WeekdayDefaults | undefined;
  signedIn: boolean;
  onUpdateDefaults: (defaults: DefaultCategory[]) => void;
  onUpdateWeekdayDefaults: (next: WeekdayDefaults) => void;
  onResetToday: () => void | Promise<void>;
  onClearAllData: () => void | Promise<void>;
  onDeleteAccount: () => void | Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>("all");
  const [confirmAction, setConfirmAction] = useState<Action | null>(null);

  const allDays = useMemo(
    () => (defaults !== undefined ? defaults : builtInDefaults()),
    [defaults],
  );

  const dayOverride =
    tab === "all" ? undefined : weekdayDefaults?.[tab];
  const isOverridden = tab !== "all" && dayOverride !== undefined;
  const editable = tab === "all" ? allDays : (dayOverride ?? allDays);

  const handleEditorChange = (next: DefaultCategory[]) => {
    if (tab === "all") {
      onUpdateDefaults(next);
    } else {
      onUpdateWeekdayDefaults({ ...(weekdayDefaults ?? {}), [tab]: next });
    }
  };

  const overrideThisDay = () => {
    if (tab === "all") return;
    onUpdateWeekdayDefaults({
      ...(weekdayDefaults ?? {}),
      [tab]: cloneDefaults(allDays),
    });
  };

  const removeOverride = () => {
    if (tab === "all") return;
    const next = { ...(weekdayDefaults ?? {}) };
    delete next[tab];
    onUpdateWeekdayDefaults(next);
  };

  const today = todayWeekday();

  return (
    <div className="settings-page">
      <section className="settings-section">
        <div className="settings-section-head">
          <h3>Default categories</h3>
          <p className="settings-section-desc">
            "All days" is the base template. Pick a specific day to override
            it. Defaults apply when you reset today and at midnight rollover.
          </p>
        </div>

        <div className="weekday-tabs" role="tablist" aria-label="Weekday">
          <button
            role="tab"
            aria-selected={tab === "all"}
            className={`weekday-tab ${tab === "all" ? "active" : ""}`}
            onClick={() => setTab("all")}
          >
            All days
          </button>
          {WEEKDAYS.map((wd) => {
            const has = weekdayDefaults?.[wd] !== undefined;
            return (
              <button
                key={wd}
                role="tab"
                aria-selected={tab === wd}
                className={`weekday-tab ${tab === wd ? "active" : ""} ${
                  has ? "has-override" : ""
                } ${wd === today ? "is-today" : ""}`}
                onClick={() => setTab(wd)}
                title={WEEKDAY_LABELS_LONG[wd]}
              >
                {WEEKDAY_LABELS[wd]}
                {has && <span className="weekday-tab-dot" aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        <div className="weekday-banner">
          {tab === "all" ? (
            <p className="settings-section-desc weekday-banner-desc">
              Used as the fallback for any day that has no override.
            </p>
          ) : isOverridden ? (
            <>
              <p className="settings-section-desc weekday-banner-desc">
                Custom defaults for {WEEKDAY_LABELS_LONG[tab]}.
              </p>
              <button
                className="btn-ghost weekday-banner-action"
                onClick={removeOverride}
              >
                Use All-days defaults
              </button>
            </>
          ) : (
            <>
              <p className="settings-section-desc weekday-banner-desc">
                {WEEKDAY_LABELS_LONG[tab]} inherits the All-days defaults.
              </p>
              <button
                className="btn-ghost weekday-banner-action"
                onClick={overrideThisDay}
              >
                Override for {WEEKDAY_LABELS[tab]}
              </button>
            </>
          )}
        </div>

        <DefaultsEditor
          key={tab === "all" ? "all" : `wd-${tab}-${isOverridden ? "ov" : "in"}`}
          value={editable}
          editable={tab === "all" || isOverridden}
          onChange={handleEditorChange}
        />
      </section>

      <section className="settings-section">
        <div className="settings-section-head">
          <h3>Reset today</h3>
          <p className="settings-section-desc">
            Replaces today's categories with {WEEKDAY_LABELS_LONG[today]}'s
            defaults. Spent time and the active timer will be cleared.
          </p>
        </div>
        <div className="settings-action">
          <button onClick={() => setConfirmAction("reset")}>Reset today</button>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-head">
          <h3>Clear all data</h3>
          <p className="settings-section-desc">
            Removes today's state and all history. Defaults are preserved.
            This cannot be undone.
          </p>
        </div>
        <div className="settings-action">
          <button
            className="btn-destructive"
            onClick={() => setConfirmAction("clear")}
          >
            Clear all data
          </button>
        </div>
      </section>

      {signedIn && (
        <section className="settings-section settings-section-danger">
          <div className="settings-section-head">
            <h3>Delete account</h3>
            <p className="settings-section-desc">
              Permanently deletes your account, including today's state and
              all history. You will be signed out immediately. This cannot
              be undone.
            </p>
          </div>
          <div className="settings-action">
            <button
              className="btn-destructive"
              onClick={() => setConfirmAction("delete")}
            >
              Delete account
            </button>
          </div>
        </section>
      )}

      {confirmAction === "reset" && (
        <Confirm
          title="Reset today?"
          body={`Today's spent time and any active timer will be cleared. ${WEEKDAY_LABELS_LONG[today]}'s defaults will be applied.`}
          confirmLabel="Reset today"
          destructive
          onConfirm={onResetToday}
          onClose={() => setConfirmAction(null)}
        />
      )}
      {confirmAction === "clear" && (
        <Confirm
          title="Clear all data?"
          body="Today's state and all history will be permanently deleted. This cannot be undone."
          confirmLabel="Clear all data"
          destructive
          onConfirm={onClearAllData}
          onClose={() => setConfirmAction(null)}
        />
      )}
      {confirmAction === "delete" && (
        <Confirm
          title="Delete your account?"
          body={
            <>
              This permanently deletes your account, today's state, and all
              history across all devices. You will be signed out immediately.
              <br />
              <br />
              This action cannot be undone.
            </>
          }
          confirmLabel="Delete account"
          destructive
          typeToConfirm="DELETE"
          onConfirm={onDeleteAccount}
          onClose={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}

function cloneDefaults(list: DefaultCategory[]): DefaultCategory[] {
  return list.map((d) => ({ ...d, id: cryptoId() }));
}

function DefaultsEditor({
  value,
  editable,
  onChange,
}: {
  value: DefaultCategory[];
  editable: boolean;
  onChange: (next: DefaultCategory[]) => void;
}) {
  const update = (id: string, patch: Partial<DefaultCategory>) => {
    onChange(value.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };
  const remove = (id: string) => {
    onChange(value.filter((d) => d.id !== id));
  };
  const add = () => {
    onChange([
      ...value,
      {
        id: cryptoId(),
        name: "",
        budgetSec: 3600,
        color: PALETTE[value.length % PALETTE.length],
      },
    ]);
  };

  return (
    <div className={`defaults-editor ${editable ? "" : "is-readonly"}`}>
      <ul className="defaults-list">
        {value.map((d) => (
          <DefaultRow
            key={d.id}
            value={d}
            editable={editable}
            onChange={(patch) => update(d.id, patch)}
            onRemove={() => remove(d.id)}
          />
        ))}
        {value.length === 0 && (
          <li className="defaults-empty">
            No default categories. {editable ? "Add one to seed your day." : ""}
          </li>
        )}
      </ul>
      {editable && (
        <button type="button" className="btn-ghost defaults-add" onClick={add}>
          + Add category
        </button>
      )}
    </div>
  );
}

function DefaultRow({
  value,
  editable,
  onChange,
  onRemove,
}: {
  value: DefaultCategory;
  editable: boolean;
  onChange: (patch: Partial<DefaultCategory>) => void;
  onRemove: () => void;
}) {
  const [budgetText, setBudgetText] = useState(fmtBudget(value.budgetSec));
  const [budgetErr, setBudgetErr] = useState(false);

  const commitBudget = () => {
    const sec = parseBudget(budgetText);
    if (sec == null || sec <= 0) {
      setBudgetErr(true);
      setBudgetText(fmtBudget(value.budgetSec));
      return;
    }
    setBudgetErr(false);
    if (sec !== value.budgetSec) onChange({ budgetSec: sec });
    setBudgetText(fmtBudget(sec));
  };

  return (
    <li className="defaults-row">
      <span className="defaults-swatch" style={{ background: value.color }} />
      <input
        className="defaults-name"
        value={value.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="Category name"
        aria-label="Default category name"
        disabled={!editable}
      />
      <input
        className={`defaults-budget ${budgetErr ? "input-error" : ""}`}
        value={budgetText}
        onChange={(e) => {
          setBudgetText(e.target.value);
          setBudgetErr(false);
        }}
        onBlur={commitBudget}
        placeholder="e.g. 1h 30m"
        aria-label="Default budget"
        disabled={!editable}
      />
      {editable && (
        <button
          type="button"
          className="btn-icon btn-danger"
          onClick={onRemove}
          aria-label="Remove default category"
        >
          ×
        </button>
      )}
    </li>
  );
}
