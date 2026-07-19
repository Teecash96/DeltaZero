"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type FormEvent } from "react";

import { clearDemoAccess, enableDemoAccess, hasDemoAccess, subscribeToDemoAccess } from "@/lib/demo-access";

export function DemoAccessForm() {
  const [key, setKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const enabled = useSyncExternalStore(subscribeToDemoAccess, hasDemoAccess, () => false);

  function enable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = enableDemoAccess(key);
    setKey("");
    setMessage(saved ? "Demo access enabled for this browser session." : "Enter a demo access key to continue.");
  }

  function clear() {
    clearDemoAccess();
    setKey("");
    setMessage("Demo access cleared for this browser session.");
  }

  return (
    <div className="workspace demo-access-page">
      <section className="panel demo-access-card" aria-labelledby="demo-access-title">
        <div className="demo-access-heading">
          <span>Recording utility</span>
          <h1 id="demo-access-title">DeltaZero Demo Access</h1>
          <p>This key is not required during the free listing preview. Keep it only for recording and testing after paid access is restored.</p>
        </div>
        <form onSubmit={enable}>
          <label htmlFor="demo-access-key">Demo access key</label>
          <input
            id="demo-access-key"
            name="demo-access-key"
            type="password"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <div className="demo-access-actions">
            <button className="button button-primary" type="submit">Enable Demo Access</button>
            <button className="button button-secondary" type="button" onClick={clear}>Clear Demo Access</button>
            <Link className="button button-secondary" href="/builder">Go to App</Link>
          </div>
        </form>
        {(message || enabled) ? (
          <p className={`demo-access-status${enabled ? " demo-access-status-enabled" : ""}`} role="status">
            {message ?? "Demo access enabled for this browser session."}
          </p>
        ) : null}
        <p className="demo-access-warning">Do not share this key publicly. This does not grant wallet access, custody, or trading permission.</p>
      </section>
    </div>
  );
}
