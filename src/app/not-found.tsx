"use client";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileQuestion, LayoutDashboard, Upload } from "lucide-react";
import Link from "next/link";

// Neutral 404: the visitor may be staff or a creator, so offer both entry points
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="max-w-lg w-full">
        <Card className="border-border shadow-xl overflow-hidden">
          <CardHeader className="text-center pt-10 pb-6">
            {/* 404 illustration */}
            <div className="mx-auto mb-4 h-24 w-24 rounded-3xl bg-primary/10 flex items-center justify-center">
              <FileQuestion className="h-12 w-12 text-primary" />
            </div>

            {/* Large 404 text */}
            <div className="text-7xl font-bold text-primary">
              404
            </div>

            <CardTitle className="text-2xl mt-4">
              Page Not Found
            </CardTitle>
            <CardDescription className="text-base mt-2 max-w-md mx-auto">
              The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </CardDescription>
          </CardHeader>

          <CardFooter className="flex flex-col gap-3 pt-2 pb-6">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                if (window.history.length > 1) {
                  window.history.back();
                }
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Button asChild className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                <Link href="/creator/dashboard">
                  <Upload className="h-4 w-4 mr-2" />
                  Creator portal
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href="/dashboard">
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Staff dashboard
                </Link>
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
