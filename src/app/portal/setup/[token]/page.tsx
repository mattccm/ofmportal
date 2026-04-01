"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Creator {
  id: string;
  name: string;
  email: string;
  agencyName: string;
}

export default function PortalSetupPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [creator, setCreator] = useState<Creator | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });

  const passwordRequirements = [
    { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
    { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
    { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
    { label: "One number", test: (p: string) => /[0-9]/.test(p) },
  ];

  useEffect(() => {
    async function verifyToken() {
      try {
        const response = await fetch(`/api/portal/verify-invite?token=${token}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Invalid or expired invite link");
          setLoading(false);
          return;
        }

        setCreator(data);
      } catch {
        setError("Failed to verify invite");
      } finally {
        setLoading(false);
      }
    }

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    const failedReqs = passwordRequirements.filter(
      (req) => !req.test(formData.password)
    );
    if (failedReqs.length > 0) {
      toast.error("Password does not meet all requirements");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/portal/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Setup failed");
        setSubmitting(false);
        return;
      }

      toast.success("Account set up successfully!");
      router.push(`/login?email=${encodeURIComponent(creator!.email)}`);
    } catch {
      toast.error("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-600">Invalid Invite</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">
              Please contact your agency to request a new invite link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle>Set Up Your Portal Access</CardTitle>
          <CardDescription>
            Hi {creator?.name}! Create a password to access your content portal for{" "}
            <strong>{creator?.agencyName}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={creator?.email || ""}
                disabled
                className="bg-gray-50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Create Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a secure password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
                disabled={submitting}
              />
              <div className="space-y-1 mt-2">
                {passwordRequirements.map((req, index) => (
                  <div
                    key={index}
                    className={`flex items-center text-sm ${
                      formData.password && req.test(formData.password)
                        ? "text-green-600"
                        : "text-gray-500"
                    }`}
                  >
                    {formData.password && req.test(formData.password) ? (
                      <Check className="h-4 w-4 mr-2" />
                    ) : (
                      <X className="h-4 w-4 mr-2" />
                    )}
                    {req.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({ ...formData, confirmPassword: e.target.value })
                }
                required
                disabled={submitting}
              />
              {formData.confirmPassword && (
                <div
                  className={`flex items-center text-sm ${
                    formData.password === formData.confirmPassword
                      ? "text-green-600"
                      : "text-red-500"
                  }`}
                >
                  {formData.password === formData.confirmPassword ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Passwords match
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4 mr-2" />
                      Passwords do not match
                    </>
                  )}
                </div>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Set Up Account
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
