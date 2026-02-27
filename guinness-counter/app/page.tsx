// app/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type LeaderboardRow = {
  id: string;
  name: string;
  count: number;
  updated_at: string;
  created_at: string;
};

export default function Page() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");

  const [selected, setSelected] = useState<LeaderboardRow | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(
    () => rows.reduce((sum, r) => sum + (r.count ?? 0), 0),
    [rows]
  );

  async function fetchLeaderboard() {
    setError(null);
    setLoading(true);

    const { data, error } = await supabase
      .from("leaderboard")
      .select("id,name,count,updated_at,created_at");

    if (error) {
      setError(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    // Viewet er allerede sortert, men vi sorterer for sikkerhet:
    const sorted = (data ?? []).sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
    setRows(sorted as LeaderboardRow[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const name = newName.trim();
    if (!name) return;

    // Insert i profiles. Trigger oppretter guinness_counts automatisk.
    const { error } = await supabase.from("profiles").insert([{ name }]);

    if (error) {
      // Typisk: duplicate key (samme navn)
      setError(error.message);
      return;
    }

    setNewName("");
    await fetchLeaderboard();
  }

  async function changeCount(delta: number) {
    if (!selected) return;
    setModalBusy(true);
    setError(null);

    const current = selected.count ?? 0;
    const next = Math.max(0, current + delta); // ingen negative tall

    const { error } = await supabase
      .from("guinness_counts")
      .update({ count: next })
      .eq("user_id", selected.id);

    if (error) {
      setError(error.message);
      setModalBusy(false);
      return;
    }

    // Oppdater lokalt + refetch for å holde leaderboard korrekt
    setSelected({ ...selected, count: next });
    await fetchLeaderboard();
    setModalBusy(false);
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>Guinness Leaderboard 🍺</h1>
            <p style={styles.subtitle}>
              Totalt drukket: <strong>{total}</strong>
            </p>
          </div>

          <form onSubmit={addUser} style={styles.addForm}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Legg til bruker (navn)…"
              style={styles.input}
              maxLength={40}
            />
            <button type="submit" style={styles.buttonPrimary}>
              Legg til
            </button>
          </form>
        </header>

        {error && (
          <div style={styles.errorBox}>
            <strong>Feil:</strong> {error}
          </div>
        )}

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Leaderboard</h2>
            <button
              onClick={fetchLeaderboard}
              style={styles.buttonGhost}
              disabled={loading}
              title="Oppdater"
            >
              {loading ? "Laster…" : "Oppdater"}
            </button>
          </div>

          {loading ? (
            <div style={styles.skeletonWrap}>
              <div style={styles.skeleton} />
              <div style={styles.skeleton} />
              <div style={styles.skeleton} />
            </div>
          ) : rows.length === 0 ? (
            <p style={{ margin: 0, opacity: 0.8 }}>
              Ingen brukere enda. Legg til første øverst.
            </p>
          ) : (
            <ul style={styles.list}>
              {rows.map((r, idx) => (
                <li key={r.id} style={styles.row}>
                  <button
                    onClick={() => setSelected(r)}
                    style={styles.rowButton}
                    title="Klikk for å endre"
                  >
                    <div style={styles.rowLeft}>
                      <div style={styles.rank}>#{idx + 1}</div>
                      <div style={styles.name}>{r.name}</div>
                    </div>
                    <div style={styles.countPill}>
                      <span style={styles.countNumber}>{r.count ?? 0}</span>
                      <span style={styles.countLabel}>Guinness</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer style={styles.footer}>
          <span style={{ opacity: 0.8 }}>
            Klikk på en person for å justere 🍺
          </span>
        </footer>
      </div>

      {/* Modal */}
      {selected && (
        <div
          style={styles.modalOverlay}
          onClick={() => (modalBusy ? null : setSelected(null))}
        >
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{selected.name}</h3>
              <button
                style={styles.buttonGhost}
                onClick={() => setSelected(null)}
                disabled={modalBusy}
              >
                Lukk
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.bigCount}>
                {selected.count ?? 0} <span style={{ opacity: 0.8 }}>🍺</span>
              </div>

              <div style={styles.modalActions}>
                <button
                  onClick={() => changeCount(-1)}
                  style={styles.buttonSecondary}
                  disabled={modalBusy || (selected.count ?? 0) <= 0}
                >
                  − 1
                </button>
                <button
                  onClick={() => changeCount(+1)}
                  style={styles.buttonPrimary}
                  disabled={modalBusy}
                >
                  + 1
                </button>
              </div>

             
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Superenkel inline styling (ingen Tailwind nødvendig)
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 20% 10%, rgba(255,255,255,0.10), transparent), linear-gradient(180deg, #0b0b0d, #111118)",
    color: "white",
    padding: "28px 16px",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
  },
  container: { maxWidth: 760, margin: "0 auto" },
  header: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
    alignItems: "end",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: { margin: 0, fontSize: 28, letterSpacing: -0.3 },
  subtitle: { margin: "6px 0 0", opacity: 0.85 },
  addForm: { display: "flex", gap: 10, alignItems: "center" },
  input: {
    width: 260,
    maxWidth: "65vw",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    outline: "none",
  },
  buttonPrimary: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(255,255,255,0.16)",
    color: "white",
    cursor: "pointer",
    fontWeight: 600,
  },
  buttonSecondary: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.20)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    cursor: "pointer",
    fontWeight: 600,
    minWidth: 90,
  },
  buttonGhost: {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "transparent",
    color: "white",
    cursor: "pointer",
    opacity: 0.9,
  },
  card: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    padding: 14,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  cardTitle: { margin: 0, fontSize: 16, opacity: 0.9 },
  list: { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 },
  row: { margin: 0 },
  rowButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.18)",
    color: "white",
    cursor: "pointer",
  },
  rowLeft: { display: "flex", alignItems: "center", gap: 10 },
  rank: {
    width: 42,
    textAlign: "center",
    padding: "6px 8px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    fontVariantNumeric: "tabular-nums",
    opacity: 0.95,
  },
  name: { fontSize: 16, fontWeight: 650, letterSpacing: -0.2 },
  countPill: {
    display: "flex",
    gap: 8,
    alignItems: "baseline",
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.08)",
    fontVariantNumeric: "tabular-nums",
  },
  countNumber: { fontSize: 18, fontWeight: 800 },
  countLabel: { fontSize: 12, opacity: 0.85 },
  footer: { marginTop: 12, padding: "6px 2px", fontSize: 13 },

  errorBox: {
    marginBottom: 12,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,120,120,0.35)",
    background: "rgba(255,120,120,0.12)",
  },

  skeletonWrap: { display: "grid", gap: 10 },
  skeleton: {
    height: 54,
    borderRadius: 14,
    background:
      "linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.12), rgba(255,255,255,0.06))",
    animation: "pulse 1.2s infinite",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    display: "grid",
    placeItems: "center",
    padding: 16,
  },
  modal: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(20,20,26,0.95)",
    boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 14px 10px",
    borderBottom: "1px solid rgba(255,255,255,0.10)",
  },
  modalTitle: { margin: 0, fontSize: 16, letterSpacing: -0.2 },
  modalBody: { padding: 14 },
  bigCount: {
    fontSize: 44,
    fontWeight: 900,
    letterSpacing: -1,
    marginBottom: 12,
  },
  modalActions: { display: "flex", gap: 10 },
  modalHint: { marginTop: 12, marginBottom: 0, opacity: 0.75, fontSize: 13 },
};