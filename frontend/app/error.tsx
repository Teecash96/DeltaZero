"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="workspace">
      <div className="error-box" style={{ marginTop: "60px" }}>
        <span className="state-icon">!</span>
        <div>
          <strong>Something went wrong</strong>
          <p>{error.message || "An unexpected error occurred."}</p>
          <small>
            Try refreshing the page. If the issue persists, check the API status
            or open a GitHub issue.
          </small>
          <br />
          <br />
          <button
            className="button button-primary"
            onClick={() => reset()}
            style={{ minHeight: "44px", padding: "0 18px", fontSize: "13px" }}
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
