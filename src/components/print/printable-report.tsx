"use client";

import * as React from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Users,
  FileText,
  Upload,
  CheckCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";

interface ReportMetric {
  label: string;
  value: string | number;
  previousValue?: string | number;
  change?: number;
  changeType?: "positive" | "negative" | "neutral";
  icon?: React.ReactNode;
}

interface ReportSection {
  title: string;
  description?: string;
  metrics?: ReportMetric[];
  tableData?: {
    headers: string[];
    rows: (string | number)[][];
  };
  chartPlaceholder?: string;
}

interface PrintableReportProps {
  title: string;
  subtitle?: string;
  dateRange: {
    start: string;
    end: string;
  };
  sections: ReportSection[];
  summary?: string;
  agencyName?: string;
  agencyLogo?: string;
  reportType?: "analytics" | "performance" | "requests" | "creators";
  generatedBy?: string;
  className?: string;
}

function TrendIndicator({
  change,
  type,
}: {
  change: number;
  type?: "positive" | "negative" | "neutral";
}) {
  const isPositive = type === "positive" || (type === undefined && change > 0);
  const isNeutral = type === "neutral" || change === 0;

  if (isNeutral) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        No change
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        isPositive
          ? "text-emerald-600 print:text-emerald-700"
          : "text-red-600 print:text-red-700"
      )}
    >
      {change > 0 ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

export function PrintableReport({
  title,
  subtitle,
  dateRange,
  sections,
  summary,
  agencyName,
  agencyLogo,
  reportType = "analytics",
  generatedBy,
  className,
}: PrintableReportProps) {
  const printDate = format(new Date(), "MMMM d, yyyy 'at' h:mm a");
  const formattedDateRange = `${format(
    new Date(dateRange.start),
    "MMM d, yyyy"
  )} - ${format(new Date(dateRange.end), "MMM d, yyyy")}`;

  const getReportIcon = () => {
    switch (reportType) {
      case "performance":
        return <TrendingUp className="h-5 w-5" />;
      case "requests":
        return <FileText className="h-5 w-5" />;
      case "creators":
        return <Users className="h-5 w-5" />;
      default:
        return <BarChart3 className="h-5 w-5" />;
    }
  };

  return (
    <div
      className={cn(
        "printable-report print:block print-landscape",
        className
      )}
    >
      {/* Print Header */}
      <div className="print-header print-only hidden print:flex print:justify-between print:items-center">
        <div className="flex items-center gap-2">
          {agencyLogo && (
            <img src={agencyLogo} alt={agencyName} className="h-6 w-auto" />
          )}
          {agencyName && <span className="font-medium">{agencyName}</span>}
        </div>
        <div className="text-muted-foreground">{reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report</div>
      </div>

      {/* Report Header */}
      <div className="report-header text-center border-b-2 border-foreground pb-6 mb-6">
        <div className="inline-flex items-center justify-center gap-2 mb-2 text-primary print:text-gray-700">
          {getReportIcon()}
          <Badge variant="outline" className="uppercase text-xs">
            {reportType} Report
          </Badge>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2 print:text-2xl">
          {title}
        </h1>
        {subtitle && (
          <p className="text-muted-foreground mb-2">{subtitle}</p>
        )}
        <div className="report-date flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          {formattedDateRange}
        </div>
      </div>

      {/* Executive Summary */}
      {summary && (
        <div className="summary-section bg-muted/30 rounded-lg p-6 mb-8 print:bg-gray-50 print:border print:border-gray-200 print:break-inside-avoid">
          <h2 className="text-lg font-semibold mb-2">Executive Summary</h2>
          <p className="text-sm text-muted-foreground">{summary}</p>
        </div>
      )}

      {/* Report Sections */}
      {sections.map((section, index) => (
        <div
          key={index}
          className={cn(
            "mb-8 print:break-inside-avoid",
            index > 0 && "print:break-before-page"
          )}
        >
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2 border-b pb-2">
            {section.title}
          </h2>
          {section.description && (
            <p className="text-sm text-muted-foreground mb-4">
              {section.description}
            </p>
          )}

          {/* Metrics Grid */}
          {section.metrics && section.metrics.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 print:flex print:flex-wrap print:gap-4">
              {section.metrics.map((metric, metricIndex) => (
                <div
                  key={metricIndex}
                  className="p-4 border rounded-lg print:flex-1 print:min-w-[140px] print:border-gray-300"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {metric.icon && (
                      <span className="text-muted-foreground">
                        {metric.icon}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">
                      {metric.label}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-foreground mb-1">
                    {metric.value}
                  </div>
                  {metric.previousValue !== undefined && (
                    <div className="text-xs text-muted-foreground">
                      Previous: {metric.previousValue}
                    </div>
                  )}
                  {metric.change !== undefined && (
                    <TrendIndicator
                      change={metric.change}
                      type={metric.changeType}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Table Data */}
          {section.tableData && (
            <div className="border rounded-lg overflow-hidden print:border-gray-300">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 print:bg-gray-100">
                    {section.tableData.headers.map((header, headerIndex) => (
                      <th
                        key={headerIndex}
                        className="text-left p-3 font-medium"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.tableData.rows.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className="border-t print:border-gray-200"
                    >
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="p-3">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Chart Placeholder */}
          {section.chartPlaceholder && (
            <div className="chart-container p-6 border rounded-lg text-center bg-muted/20 print:border-gray-300 print:bg-gray-50">
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {section.chartPlaceholder}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                (Chart visualization - see interactive report for details)
              </p>
            </div>
          )}
        </div>
      ))}

      {/* Report Footer */}
      <div className="print-footer print-only hidden print:block mt-8 pt-4 border-t text-center text-xs text-muted-foreground">
        <p>
          Report generated on {printDate}
          {agencyName && ` | ${agencyName}`}
        </p>
        {generatedBy && <p className="mt-1">Generated by: {generatedBy}</p>}
        <p className="mt-1">
          Report Period: {formattedDateRange} | Type:{" "}
          {reportType.charAt(0).toUpperCase() + reportType.slice(1)}
        </p>
      </div>
    </div>
  );
}

// Pre-built report templates
export function RequestsReport({
  data,
  dateRange,
  agencyName,
  agencyLogo,
}: {
  data: {
    totalRequests: number;
    completedRequests: number;
    pendingRequests: number;
    overdueRequests: number;
    avgCompletionTime: string;
    byStatus: { status: string; count: number }[];
    byCreator: { name: string; completed: number; pending: number }[];
  };
  dateRange: { start: string; end: string };
  agencyName?: string;
  agencyLogo?: string;
}) {
  const sections: ReportSection[] = [
    {
      title: "Request Overview",
      description: "Summary of all content requests for the reporting period.",
      metrics: [
        {
          label: "Total Requests",
          value: data.totalRequests,
          icon: <FileText className="h-4 w-4" />,
        },
        {
          label: "Completed",
          value: data.completedRequests,
          icon: <CheckCircle className="h-4 w-4" />,
        },
        {
          label: "Pending",
          value: data.pendingRequests,
          icon: <Clock className="h-4 w-4" />,
        },
        {
          label: "Overdue",
          value: data.overdueRequests,
          icon: <AlertTriangle className="h-4 w-4" />,
        },
      ],
    },
    {
      title: "Requests by Status",
      tableData: {
        headers: ["Status", "Count", "Percentage"],
        rows: data.byStatus.map((item) => [
          item.status,
          item.count,
          `${Math.round((item.count / data.totalRequests) * 100)}%`,
        ]),
      },
    },
    {
      title: "Requests by Creator",
      description: "Performance breakdown by creator.",
      tableData: {
        headers: ["Creator", "Completed", "Pending", "Completion Rate"],
        rows: data.byCreator.map((item) => {
          const total = item.completed + item.pending;
          const rate = total > 0 ? Math.round((item.completed / total) * 100) : 0;
          return [item.name, item.completed, item.pending, `${rate}%`];
        }),
      },
    },
  ];

  return (
    <PrintableReport
      title="Content Requests Report"
      subtitle={`Comprehensive overview of request status and performance`}
      dateRange={dateRange}
      sections={sections}
      summary={`During this period, ${data.totalRequests} requests were tracked with a ${Math.round(
        (data.completedRequests / data.totalRequests) * 100
      )}% completion rate. Average completion time was ${data.avgCompletionTime}. ${data.overdueRequests} requests are currently overdue.`}
      agencyName={agencyName}
      agencyLogo={agencyLogo}
      reportType="requests"
    />
  );
}

export function AnalyticsReport({
  data,
  dateRange,
  agencyName,
  agencyLogo,
}: {
  data: {
    totalUploads: number;
    uploadsChange: number;
    totalStorage: string;
    storageChange: number;
    activeCreators: number;
    creatorsChange: number;
    avgResponseTime: string;
    responseTimeChange: number;
    topPerformers: { name: string; uploads: number; onTime: number }[];
  };
  dateRange: { start: string; end: string };
  agencyName?: string;
  agencyLogo?: string;
}) {
  const sections: ReportSection[] = [
    {
      title: "Key Metrics",
      metrics: [
        {
          label: "Total Uploads",
          value: data.totalUploads,
          change: data.uploadsChange,
          changeType: data.uploadsChange >= 0 ? "positive" : "negative",
          icon: <Upload className="h-4 w-4" />,
        },
        {
          label: "Storage Used",
          value: data.totalStorage,
          change: data.storageChange,
          icon: <BarChart3 className="h-4 w-4" />,
        },
        {
          label: "Active Creators",
          value: data.activeCreators,
          change: data.creatorsChange,
          changeType: data.creatorsChange >= 0 ? "positive" : "negative",
          icon: <Users className="h-4 w-4" />,
        },
        {
          label: "Avg Response Time",
          value: data.avgResponseTime,
          change: data.responseTimeChange,
          changeType: data.responseTimeChange <= 0 ? "positive" : "negative",
          icon: <Clock className="h-4 w-4" />,
        },
      ],
    },
    {
      title: "Top Performers",
      description: "Creators with the highest performance metrics.",
      tableData: {
        headers: ["Creator", "Uploads", "On-Time Delivery %"],
        rows: data.topPerformers.map((p) => [p.name, p.uploads, `${p.onTime}%`]),
      },
    },
    {
      title: "Upload Trends",
      chartPlaceholder:
        "Upload volume trend chart showing daily/weekly upload activity",
    },
  ];

  return (
    <PrintableReport
      title="Analytics Report"
      subtitle="Platform performance and usage statistics"
      dateRange={dateRange}
      sections={sections}
      summary={`Platform activity shows ${data.totalUploads} uploads with ${data.activeCreators} active creators. Average response time is ${data.avgResponseTime}.`}
      agencyName={agencyName}
      agencyLogo={agencyLogo}
      reportType="analytics"
    />
  );
}

export type { ReportSection, ReportMetric, PrintableReportProps };
