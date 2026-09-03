"use client";

import { Search } from "lucide-react";
import { categories } from "@/app/data/categories";

type SearchAndFilterProps = {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
};

export default function SearchAndFilter({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
}: SearchAndFilterProps) {
  return (
    <div className="flex flex-1 flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
        <input
          id="overlaySearchInput"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          type="text"
          placeholder="Search for a clinic, bank, or salon..."
          className="w-full rounded-xl border border-[#374151] bg-[#111827] py-2.5 pl-10 pr-3 text-sm text-white placeholder-[#9CA3AF] transition-all duration-300 ease-in-out focus:border-[#10B981] focus:outline-none focus:ring-2 focus:ring-[#10B981]/50"
        />
      </div>
      <select
        value={selectedCategory}
        onChange={(event) => setSelectedCategory(event.target.value)}
        aria-label="Filter by category"
        className="rounded-xl border border-[#374151] bg-[#111827] px-3 py-2.5 text-sm text-white transition-all duration-300 ease-in-out focus:border-[#10B981] focus:outline-none"
      >
        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
      </select>
    </div>
  );
}
