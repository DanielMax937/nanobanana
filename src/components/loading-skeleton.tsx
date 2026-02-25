"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function ShotCardSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="aspect-video w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

export function ParseLoadingSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <ShotCardSkeleton />
      <ShotCardSkeleton />
      <ShotCardSkeleton />
    </div>
  );
}
