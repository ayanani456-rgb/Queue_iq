import { Calendar } from "lucide-react";

export default function UniversalCard({ item, onBook }: any) {
  return (
    <div
      onClick={() => onBook(item)}
      className="group relative cursor-pointer rounded-2xl border border-[#374151] bg-[#1F2937] p-5 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:border-[#10B981] hover:shadow-xl"
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white transition-colors duration-300 group-hover:text-[#10B981]">{item.name}</h3>
          <p className="mt-1 text-xs text-[#9CA3AF]">{item.category} • {item.location}</p>
        </div>
        <div className="flex items-center gap-1 text-sm font-bold text-[#10B981]">★ {item.rating || item.stars || "4.8"}</div>
      </div>
      <div className="mb-4 flex items-center gap-2 text-xs text-[#9CA3AF]">
        <span>⏱</span><span>{item.waitTime || item.wait || "15 min"} wait</span>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onBook(item); }}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#10B981] px-6 py-3.5 text-sm font-bold text-white shadow-md transition-all duration-300 ease-in-out hover:-translate-y-1 hover:bg-[#0D9D6E] hover:shadow-xl"
      >
        <Calendar className="h-4 w-4" />
        Book Your Appointment
      </button>
    </div>
  );
}
