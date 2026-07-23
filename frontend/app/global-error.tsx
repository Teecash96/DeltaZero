"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: "grid",
            placeItems: "center",
            minHeight: "100vh",
            padding: "28px",
            background: "#080c09",
            color: "#f4f7f4",
            fontFamily: "Inter, ui-sans-serif, sans-serif",
          }}
        >
          <div style={{ maxWidth: "480px", textAlign: "center" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                margin: "0 auto 20px",
                display: "grid",
                placeItems: "center",
                border: "1px solid #754542",
                borderRadius: "18px",
                color: "#ff8d85",
                fontSize: "25px",
                fontWeight: 800,
              }}
            >
              !
            </div>
            <strong
              style={{ display: "block", fontSize: "18px", marginBottom: "10px" }}
            >
              Critical error
            </strong>
            <p
              style={{
                color: "#a2aca4",
                lineHeight: 1.65,
                fontSize: "14px",
                margin: "0 0 24px",
              }}
            >
              {error.message || "DeltaZero encountered a critical error."}
            </p>
            <button
              onClick={() => reset()}
              style={{
                minHeight: "50px",
                padding: "0 22px",
                border: "1px solid rgba(185, 246, 90, 0.3)",
                borderRadius: "10px",
                background:
                  "linear-gradient(135deg, #b9f65a 0%, #a8d05e 100%)",
                color: "#10150e",
                fontSize: "14px",
                fontWeight: 680,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
