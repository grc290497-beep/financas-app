import { Skeleton } from "@/components/ui/skeleton";

export function FormSkeleton({ fields }: { fields: number }) {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
