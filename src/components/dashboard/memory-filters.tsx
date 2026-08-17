"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MEMORY_TYPES, MEMORY_TYPE_LABELS, MEMORY_STATUSES, MEMORY_STATUS_LABELS } from "@/lib/memory-types";

export function MemoryFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [endUserId, setEndUserId] = useState(searchParams.get("user_id") ?? "");

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  const applyTextFilters = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (search) params.set("search", search);
    else params.delete("search");
    if (endUserId) params.set("user_id", endUserId);
    else params.delete("user_id");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  const hasFilters = searchParams.get("type") || searchParams.get("status") || searchParams.get("search") || searchParams.get("user_id");

  const clearAll = () => {
    setSearch("");
    setEndUserId("");
    const params = new URLSearchParams(searchParams.toString());
    ["type", "status", "search", "user_id", "page"].forEach((k) => params.delete(k));
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <form onSubmit={applyTextFilters} className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search content..."
          className="h-8 w-56 pl-8 text-sm"
        />
      </div>
      <Input
        value={endUserId}
        onChange={(e) => setEndUserId(e.target.value)}
        placeholder="End user ID"
        className="h-8 w-36 text-sm"
      />

      <Select value={searchParams.get("type") ?? "all"} onValueChange={(v) => updateParam("type", v === "all" ? null : v)}>
        <SelectTrigger size="sm" className="text-xs">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {MEMORY_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {MEMORY_TYPE_LABELS[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={searchParams.get("status") ?? "all"} onValueChange={(v) => updateParam("status", v === "all" ? null : v)}>
        <SelectTrigger size="sm" className="text-xs">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {MEMORY_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {MEMORY_STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button type="submit" variant="outline" size="sm" className="text-xs">
        Apply
      </Button>

      {hasFilters && (
        <Button type="button" variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" onClick={clearAll}>
          <X className="size-3" />
          Clear
        </Button>
      )}
    </form>
  );
}
