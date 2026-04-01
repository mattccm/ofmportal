import { NextResponse } from "next/server";

// ============================================
// TYPES
// ============================================

type StatusLevel = "operational" | "degraded" | "partial_outage" | "major_outage";

interface ServiceStatus {
  name: string;
  status: StatusLevel;
  responseTime: number;
  lastChecked: string;
}

interface Incident {
  id: string;
  title: string;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  severity: "minor" | "major" | "critical";
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  affectedServices: string[];
  updates: {
    timestamp: string;
    message: string;
  }[];
}

interface MaintenanceAnnouncement {
  id: string;
  title: string;
  description: string;
  scheduledStart: string;
  scheduledEnd: string;
  affectedServices: string[];
  status: "scheduled" | "in_progress" | "completed";
}

interface DayStatus {
  date: string;
  status: StatusLevel;
  uptime: number;
  incidents: number;
}

interface SystemStatus {
  overall: StatusLevel;
  message: string;
  services: ServiceStatus[];
  incidents: Incident[];
  maintenance: MaintenanceAnnouncement[];
  lastUpdated: string;
}

interface UptimeHistory {
  service: string;
  days: DayStatus[];
  overallUptime: number;
}

// ============================================
// MOCK DATA GENERATORS
// ============================================

function generateMockServiceStatus(): ServiceStatus[] {
  // In a real application, these would be actual health checks
  return [
    {
      name: "API",
      status: "operational",
      responseTime: Math.floor(Math.random() * 50) + 20,
      lastChecked: new Date().toISOString(),
    },
    {
      name: "Storage",
      status: "operational",
      responseTime: Math.floor(Math.random() * 100) + 50,
      lastChecked: new Date().toISOString(),
    },
    {
      name: "Email",
      status: "operational",
      responseTime: Math.floor(Math.random() * 200) + 100,
      lastChecked: new Date().toISOString(),
    },
    {
      name: "SMS",
      status: "operational",
      responseTime: Math.floor(Math.random() * 150) + 75,
      lastChecked: new Date().toISOString(),
    },
    {
      name: "Authentication",
      status: "operational",
      responseTime: Math.floor(Math.random() * 30) + 15,
      lastChecked: new Date().toISOString(),
    },
    {
      name: "CDN",
      status: "operational",
      responseTime: Math.floor(Math.random() * 20) + 5,
      lastChecked: new Date().toISOString(),
    },
  ];
}

function generateMockIncidents(): Incident[] {
  // In a real app, these would come from an incident management system
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return [
    {
      id: "inc-001",
      title: "Increased API latency",
      status: "resolved",
      severity: "minor",
      createdAt: yesterday.toISOString(),
      updatedAt: yesterday.toISOString(),
      resolvedAt: new Date(yesterday.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      affectedServices: ["API"],
      updates: [
        {
          timestamp: yesterday.toISOString(),
          message: "We are investigating reports of increased API response times.",
        },
        {
          timestamp: new Date(yesterday.getTime() + 30 * 60 * 1000).toISOString(),
          message: "Root cause identified: database connection pool exhaustion. Implementing fix.",
        },
        {
          timestamp: new Date(yesterday.getTime() + 2 * 60 * 60 * 1000).toISOString(),
          message: "The issue has been resolved. API response times are back to normal.",
        },
      ],
    },
    {
      id: "inc-002",
      title: "Email delivery delays",
      status: "resolved",
      severity: "minor",
      createdAt: twoDaysAgo.toISOString(),
      updatedAt: twoDaysAgo.toISOString(),
      resolvedAt: new Date(twoDaysAgo.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      affectedServices: ["Email"],
      updates: [
        {
          timestamp: twoDaysAgo.toISOString(),
          message: "Some users may experience delays in receiving email notifications.",
        },
        {
          timestamp: new Date(twoDaysAgo.getTime() + 4 * 60 * 60 * 1000).toISOString(),
          message: "Email delivery has returned to normal. All queued emails have been sent.",
        },
      ],
    },
    {
      id: "inc-003",
      title: "Scheduled database maintenance",
      status: "resolved",
      severity: "minor",
      createdAt: weekAgo.toISOString(),
      updatedAt: weekAgo.toISOString(),
      resolvedAt: new Date(weekAgo.getTime() + 30 * 60 * 1000).toISOString(),
      affectedServices: ["API", "Storage"],
      updates: [
        {
          timestamp: weekAgo.toISOString(),
          message: "Performing scheduled database maintenance. Brief interruptions may occur.",
        },
        {
          timestamp: new Date(weekAgo.getTime() + 30 * 60 * 1000).toISOString(),
          message: "Database maintenance completed successfully. All services restored.",
        },
      ],
    },
  ];
}

function generateMockMaintenance(): MaintenanceAnnouncement[] {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  nextWeek.setHours(2, 0, 0, 0); // 2 AM

  return [
    {
      id: "maint-001",
      title: "Infrastructure Upgrade",
      description:
        "We will be performing a scheduled infrastructure upgrade to improve performance and reliability. Brief service interruptions may occur during the maintenance window.",
      scheduledStart: nextWeek.toISOString(),
      scheduledEnd: new Date(nextWeek.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      affectedServices: ["API", "Storage", "CDN"],
      status: "scheduled",
    },
  ];
}

function generateUptimeHistory(days: number = 90): DayStatus[] {
  const history: DayStatus[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const random = Math.random();

    let status: StatusLevel;
    let uptime: number;
    let incidents: number;

    // Most days are operational (95% chance)
    if (random > 0.95) {
      // 5% chance of some issue
      if (random > 0.99) {
        status = "major_outage";
        uptime = 90 + Math.random() * 5;
        incidents = 1;
      } else if (random > 0.97) {
        status = "partial_outage";
        uptime = 95 + Math.random() * 3;
        incidents = 1;
      } else {
        status = "degraded";
        uptime = 98 + Math.random() * 1.5;
        incidents = 1;
      }
    } else {
      status = "operational";
      uptime = 99.5 + Math.random() * 0.5;
      incidents = 0;
    }

    history.push({
      date: date.toISOString().split("T")[0],
      status,
      uptime: Math.round(uptime * 100) / 100,
      incidents,
    });
  }

  return history;
}

function calculateOverallStatus(services: ServiceStatus[]): StatusLevel {
  const statuses = services.map((s) => s.status);

  if (statuses.some((s) => s === "major_outage")) return "major_outage";
  if (statuses.some((s) => s === "partial_outage")) return "partial_outage";
  if (statuses.some((s) => s === "degraded")) return "degraded";
  return "operational";
}

function getStatusMessage(status: StatusLevel): string {
  switch (status) {
    case "operational":
      return "All systems are operating normally.";
    case "degraded":
      return "Some systems are experiencing degraded performance.";
    case "partial_outage":
      return "Some systems are experiencing an outage.";
    case "major_outage":
      return "Major systems are experiencing an outage.";
  }
}

// ============================================
// API ROUTE HANDLERS
// ============================================

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  try {
    // Health check endpoint
    if (type === "health") {
      return NextResponse.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      });
    }

    // Uptime history endpoint
    if (type === "uptime") {
      const days = parseInt(searchParams.get("days") || "90", 10);
      const service = searchParams.get("service");

      const services = ["API", "Storage", "Email", "SMS", "Authentication", "CDN"];

      if (service) {
        // Return uptime for specific service
        const history: UptimeHistory = {
          service,
          days: generateUptimeHistory(days),
          overallUptime: 99.95,
        };
        return NextResponse.json(history);
      }

      // Return uptime for all services
      const uptimeData: UptimeHistory[] = services.map((name) => ({
        service: name,
        days: generateUptimeHistory(days),
        overallUptime: 99.9 + Math.random() * 0.09,
      }));

      return NextResponse.json(uptimeData);
    }

    // Incidents endpoint
    if (type === "incidents") {
      const status = searchParams.get("status");
      let incidents = generateMockIncidents();

      if (status && status !== "all") {
        incidents = incidents.filter((i) => i.status === status);
      }

      return NextResponse.json(incidents);
    }

    // Default: Return full system status
    const services = generateMockServiceStatus();
    const overallStatus = calculateOverallStatus(services);

    const systemStatus: SystemStatus = {
      overall: overallStatus,
      message: getStatusMessage(overallStatus),
      services,
      incidents: generateMockIncidents().filter((i) => i.status !== "resolved").slice(0, 3),
      maintenance: generateMockMaintenance(),
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(systemStatus);
  } catch (error) {
    console.error("Status API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch system status" },
      { status: 500 }
    );
  }
}

// Health check POST endpoint for external monitoring
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { service } = body;

    // Simulate health check for specific service
    const isHealthy = Math.random() > 0.01; // 99% chance of healthy

    return NextResponse.json({
      service: service || "all",
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      responseTime: Math.floor(Math.random() * 100) + 10,
    });
  } catch (error) {
    console.error("Health check error:", error);
    return NextResponse.json(
      { error: "Health check failed" },
      { status: 500 }
    );
  }
}
