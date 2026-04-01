"use client";

import * as React from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";

interface InvoiceItem {
  description: string;
  quantity?: number;
  rate?: number;
  amount: number;
  details?: string;
}

interface InvoiceParty {
  name: string;
  address?: string[];
  email?: string;
  phone?: string;
}

interface PrintableInvoiceProps {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  status: "paid" | "pending" | "overdue" | "cancelled";
  from: InvoiceParty;
  to: InvoiceParty;
  items: InvoiceItem[];
  subtotal?: number;
  tax?: {
    rate: number;
    amount: number;
  };
  discount?: {
    description: string;
    amount: number;
  };
  total: number;
  currency?: string;
  notes?: string;
  terms?: string;
  requestId?: string;
  requestTitle?: string;
  agencyLogo?: string;
  className?: string;
}

function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

function StatusBadge({ status }: { status: PrintableInvoiceProps["status"] }) {
  const config = {
    paid: {
      label: "PAID",
      className: "invoice-status-paid bg-emerald-100 text-emerald-800 border-emerald-300",
      icon: <CheckCircle className="h-4 w-4" />,
    },
    pending: {
      label: "PENDING",
      className: "invoice-status-pending bg-amber-100 text-amber-800 border-amber-300",
      icon: <Clock className="h-4 w-4" />,
    },
    overdue: {
      label: "OVERDUE",
      className: "bg-red-100 text-red-800 border-red-300",
      icon: <AlertCircle className="h-4 w-4" />,
    },
    cancelled: {
      label: "CANCELLED",
      className: "bg-gray-100 text-gray-800 border-gray-300",
      icon: null,
    },
  };

  const { label, className, icon } = config[status];

  return (
    <span
      className={cn(
        "invoice-status inline-flex items-center gap-1 px-3 py-1 rounded border text-sm font-semibold",
        className
      )}
    >
      {icon}
      {label}
    </span>
  );
}

export function PrintableInvoice({
  invoiceNumber,
  invoiceDate,
  dueDate,
  status,
  from,
  to,
  items,
  subtotal,
  tax,
  discount,
  total,
  currency = "USD",
  notes,
  terms,
  requestId,
  requestTitle,
  agencyLogo,
  className,
}: PrintableInvoiceProps) {
  const formattedInvoiceDate = format(new Date(invoiceDate), "MMMM d, yyyy");
  const formattedDueDate = dueDate
    ? format(new Date(dueDate), "MMMM d, yyyy")
    : null;
  const calculatedSubtotal =
    subtotal || items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className={cn("printable-invoice print:block", className)}>
      {/* Invoice Header */}
      <div className="invoice-header flex justify-between items-start mb-8 pb-6 border-b-2 border-foreground">
        <div>
          {agencyLogo ? (
            <img
              src={agencyLogo}
              alt={from.name}
              className="invoice-logo max-h-12 mb-2"
            />
          ) : (
            <h2 className="text-xl font-bold text-foreground mb-1">
              {from.name}
            </h2>
          )}
          {from.address && (
            <div className="text-sm text-muted-foreground">
              {from.address.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
          {from.email && (
            <div className="text-sm text-muted-foreground mt-1">
              {from.email}
            </div>
          )}
        </div>

        <div className="text-right">
          <div className="invoice-title text-3xl font-bold text-foreground tracking-wider mb-2">
            INVOICE
          </div>
          <div className="invoice-number text-muted-foreground mb-2">
            #{invoiceNumber}
          </div>
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Invoice Parties */}
      <div className="invoice-parties flex justify-between mb-8 gap-8">
        <div className="invoice-party flex-1">
          <div className="invoice-party-label text-xs text-muted-foreground uppercase tracking-wider mb-2">
            Bill From
          </div>
          <div className="font-semibold">{from.name}</div>
          {from.address && (
            <div className="text-sm text-muted-foreground mt-1">
              {from.address.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
          {from.phone && (
            <div className="text-sm text-muted-foreground mt-1">
              {from.phone}
            </div>
          )}
        </div>

        <div className="invoice-party flex-1">
          <div className="invoice-party-label text-xs text-muted-foreground uppercase tracking-wider mb-2">
            Bill To
          </div>
          <div className="font-semibold">{to.name}</div>
          {to.address && (
            <div className="text-sm text-muted-foreground mt-1">
              {to.address.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
          {to.email && (
            <div className="text-sm text-muted-foreground mt-1">{to.email}</div>
          )}
        </div>

        <div className="flex-1">
          <div className="space-y-2">
            <div>
              <div className="invoice-party-label text-xs text-muted-foreground uppercase tracking-wider">
                Invoice Date
              </div>
              <div className="font-medium">{formattedInvoiceDate}</div>
            </div>
            {formattedDueDate && (
              <div>
                <div className="invoice-party-label text-xs text-muted-foreground uppercase tracking-wider">
                  Due Date
                </div>
                <div
                  className={cn(
                    "font-medium",
                    status === "overdue" && "text-red-600"
                  )}
                >
                  {formattedDueDate}
                </div>
              </div>
            )}
            {requestId && (
              <div>
                <div className="invoice-party-label text-xs text-muted-foreground uppercase tracking-wider">
                  Request Reference
                </div>
                <div className="font-medium text-sm">{requestId}</div>
                {requestTitle && (
                  <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                    {requestTitle}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Items */}
      <div className="invoice-items mb-8">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-foreground">
              <th className="text-left py-3 px-2 font-semibold">Description</th>
              {items.some((item) => item.quantity !== undefined) && (
                <th className="text-right py-3 px-2 font-semibold w-20">Qty</th>
              )}
              {items.some((item) => item.rate !== undefined) && (
                <th className="text-right py-3 px-2 font-semibold w-28">Rate</th>
              )}
              <th className="text-right py-3 px-2 font-semibold w-32">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index} className="border-b border-border">
                <td className="py-4 px-2">
                  <div className="font-medium">{item.description}</div>
                  {item.details && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {item.details}
                    </div>
                  )}
                </td>
                {items.some((i) => i.quantity !== undefined) && (
                  <td className="text-right py-4 px-2">
                    {item.quantity !== undefined ? item.quantity : "-"}
                  </td>
                )}
                {items.some((i) => i.rate !== undefined) && (
                  <td className="text-right py-4 px-2">
                    {item.rate !== undefined
                      ? formatCurrency(item.rate, currency)
                      : "-"}
                  </td>
                )}
                <td className="text-right py-4 px-2 font-medium">
                  {formatCurrency(item.amount, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invoice Totals */}
      <div className="flex justify-end mb-8">
        <div className="w-72">
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">
              {formatCurrency(calculatedSubtotal, currency)}
            </span>
          </div>

          {discount && (
            <div className="flex justify-between py-2 border-b text-emerald-600">
              <span>{discount.description}</span>
              <span className="font-medium">
                -{formatCurrency(discount.amount, currency)}
              </span>
            </div>
          )}

          {tax && (
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Tax ({tax.rate}%)</span>
              <span className="font-medium">
                {formatCurrency(tax.amount, currency)}
              </span>
            </div>
          )}

          <div className="invoice-total flex justify-between py-4 border-t-2 border-foreground mt-2">
            <span className="invoice-total-label text-lg font-semibold">
              Total
            </span>
            <span className="invoice-total-value text-2xl font-bold">
              {formatCurrency(total, currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Notes & Terms */}
      {(notes || terms) && (
        <div className="grid grid-cols-2 gap-8 mb-8 print:break-inside-avoid">
          {notes && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Notes
              </h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {notes}
              </p>
            </div>
          )}
          {terms && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Terms & Conditions
              </h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {terms}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Invoice Footer */}
      <div className="invoice-footer pt-6 border-t text-center text-sm text-muted-foreground">
        <p>Thank you for your business!</p>
        {from.email && (
          <p className="mt-1">
            Questions? Contact us at {from.email}
          </p>
        )}
        <p className="mt-2 text-xs">
          Invoice #{invoiceNumber} | Generated via UploadPortal
        </p>
      </div>
    </div>
  );
}

// Quick receipt for completed requests
export function PrintableReceipt({
  requestId,
  requestTitle,
  creatorName,
  completedDate,
  uploadCount,
  agencyName,
  agencyLogo,
  notes,
  className,
}: {
  requestId: string;
  requestTitle: string;
  creatorName: string;
  completedDate: string;
  uploadCount: number;
  agencyName?: string;
  agencyLogo?: string;
  notes?: string;
  className?: string;
}) {
  const formattedDate = format(new Date(completedDate), "MMMM d, yyyy");

  return (
    <div className={cn("printable-invoice print:block max-w-md mx-auto", className)}>
      {/* Receipt Header */}
      <div className="text-center mb-6 pb-4 border-b-2 border-foreground">
        {agencyLogo ? (
          <img
            src={agencyLogo}
            alt={agencyName}
            className="mx-auto max-h-10 mb-2"
          />
        ) : (
          agencyName && (
            <h2 className="text-lg font-bold text-foreground">{agencyName}</h2>
          )
        )}
        <div className="text-2xl font-bold tracking-wider mt-2">RECEIPT</div>
        <div className="text-sm text-muted-foreground mt-1">
          Request Completion Confirmation
        </div>
      </div>

      {/* Receipt Details */}
      <div className="space-y-4 mb-6">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Request ID:</span>
          <span className="font-mono font-medium">{requestId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Request Title:</span>
          <span className="font-medium text-right max-w-[60%]">
            {requestTitle}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Creator:</span>
          <span className="font-medium">{creatorName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Completed:</span>
          <span className="font-medium">{formattedDate}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Files Delivered:</span>
          <span className="font-medium">{uploadCount} file(s)</span>
        </div>
      </div>

      {/* Status */}
      <div className="text-center py-4 mb-6 bg-emerald-50 rounded-lg border border-emerald-200 print:bg-emerald-50">
        <CheckCircle className="h-8 w-8 mx-auto text-emerald-600 mb-2" />
        <div className="text-lg font-semibold text-emerald-800">
          Request Completed
        </div>
        <div className="text-sm text-emerald-600">
          All deliverables have been received
        </div>
      </div>

      {/* Notes */}
      {notes && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">
            Notes
          </h3>
          <p className="text-sm text-muted-foreground">{notes}</p>
        </div>
      )}

      {/* Footer */}
      <div className="pt-4 border-t text-center text-xs text-muted-foreground">
        <p>Generated via UploadPortal</p>
        <p className="mt-1">
          {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}
        </p>
      </div>
    </div>
  );
}

export type { InvoiceItem, InvoiceParty, PrintableInvoiceProps };
