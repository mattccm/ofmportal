import { NextRequest, NextResponse } from "next/server";

// Store logs in memory for quick access (will persist until server restarts)
// In production, you might want to use Redis or a database table
const sessionLogs: Array<{
  timestamp: string;
  deviceId: string;
  userAgent: string;
  event: string;
  data: Record<string, unknown>;
}> = [];

// Keep only last 100 logs to prevent memory issues
const MAX_LOGS = 100;

/**
 * POST /api/debug/session-log
 * Receives diagnostic logs from the client
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userAgent = req.headers.get("user-agent") || "unknown";

    const logEntry = {
      timestamp: new Date().toISOString(),
      deviceId: body.deviceId || "unknown",
      userAgent: userAgent.substring(0, 200), // Truncate for readability
      event: body.event || "unknown",
      data: body.data || {},
    };

    // Add to beginning of array (most recent first)
    sessionLogs.unshift(logEntry);

    // Trim old logs
    if (sessionLogs.length > MAX_LOGS) {
      sessionLogs.length = MAX_LOGS;
    }

    console.log("[SessionLog]", JSON.stringify(logEntry, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SessionLog] Error:", error);
    return NextResponse.json({ error: "Failed to log" }, { status: 500 });
  }
}

/**
 * GET /api/debug/session-log
 * Returns all collected logs (for viewing)
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const format = url.searchParams.get("format");

  if (format === "html") {
    // Return a simple HTML page for easy viewing
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Session Debug Logs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: monospace; padding: 20px; background: #1a1a2e; color: #eee; }
    h1 { color: #00d9ff; }
    .log { margin: 10px 0; padding: 15px; background: #16213e; border-radius: 8px; border-left: 4px solid #00d9ff; }
    .log.mount { border-left-color: #00ff88; }
    .log.pageshow { border-left-color: #ff6b6b; }
    .log.visibilitychange { border-left-color: #ffd93d; }
    .log.login { border-left-color: #6bcb77; }
    .timestamp { color: #888; font-size: 12px; }
    .event { color: #00d9ff; font-weight: bold; font-size: 14px; }
    .device { color: #ff6b6b; font-size: 11px; }
    .data { margin-top: 10px; white-space: pre-wrap; font-size: 12px; color: #aaa; }
    .data-key { color: #ffd93d; }
    .data-value { color: #00ff88; }
    .refresh { position: fixed; top: 10px; right: 10px; padding: 10px 20px; background: #00d9ff; color: #000; border: none; border-radius: 5px; cursor: pointer; }
    .clear { position: fixed; top: 10px; right: 100px; padding: 10px 20px; background: #ff6b6b; color: #fff; border: none; border-radius: 5px; cursor: pointer; }
    .no-logs { text-align: center; padding: 50px; color: #666; }
  </style>
</head>
<body>
  <button class="refresh" onclick="location.reload()">Refresh</button>
  <button class="clear" onclick="clearLogs()">Clear</button>
  <h1>🔍 Session Debug Logs (${sessionLogs.length})</h1>
  ${sessionLogs.length === 0 ? '<div class="no-logs">No logs yet. Waiting for client to send diagnostics...</div>' : ''}
  ${sessionLogs.map(log => `
    <div class="log ${log.event}">
      <div class="timestamp">${log.timestamp}</div>
      <div class="event">${log.event}</div>
      <div class="device">${log.deviceId} - ${log.userAgent}</div>
      <div class="data">${formatData(log.data)}</div>
    </div>
  `).join('')}
  <script>
    function clearLogs() {
      fetch('/api/debug/session-log?clear=1').then(() => location.reload());
    }
    // Auto-refresh every 5 seconds
    setTimeout(() => location.reload(), 5000);
  </script>
</body>
</html>
    `;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html" },
    });
  }

  // Check for clear parameter
  if (url.searchParams.get("clear") === "1") {
    sessionLogs.length = 0;
    return NextResponse.json({ success: true, message: "Logs cleared" });
  }

  return NextResponse.json({
    count: sessionLogs.length,
    logs: sessionLogs,
  });
}

function formatData(data: Record<string, unknown>): string {
  return Object.entries(data)
    .map(([key, value]) => {
      const valueStr = typeof value === "object" ? JSON.stringify(value) : String(value);
      return `<span class="data-key">${key}:</span> <span class="data-value">${valueStr}</span>`;
    })
    .join("\n");
}
