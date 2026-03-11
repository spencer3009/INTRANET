import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useState } from "react";

const PER_PAGE = 6;

export default function MessagePagination({ page = 1, totalPages = 1, totalMessages = 0, onPageChange }) {
  const [inputPage, setInputPage] = useState(page);

  const start = totalMessages > 0 ? (page - 1) * PER_PAGE + 1 : 0;
  const end = totalMessages > 0 ? Math.min(page * PER_PAGE, totalMessages) : 0;

  const handleInputChange = (e) => {
    const val = e.target.value;
    if (val === "") { setInputPage(""); return; }
    const num = parseInt(val);
    if (!isNaN(num)) setInputPage(num);
  };

  const handleInputSubmit = (e) => {
    if (e.key === "Enter") {
      const num = parseInt(inputPage);
      if (!isNaN(num) && num >= 1 && num <= totalPages) {
        onPageChange(num);
      } else {
        setInputPage(page);
      }
    }
  };

  // Sync input when page changes externally
  if (typeof inputPage === "number" && inputPage !== page) {
    setInputPage(page);
  }

  return (
    <div className="flex items-center justify-center gap-3 px-4 py-2.5 border-t border-gray-200 bg-gray-100 flex-shrink-0" data-testid="message-pagination">
      <button
        onClick={() => onPageChange(1)}
        disabled={page <= 1}
        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Primera"
        data-testid="pagination-first"
      >
        <ChevronsLeft className="w-5 h-5" />
      </button>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Anterior"
        data-testid="pagination-prev"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <span className="text-sm text-gray-500 select-none whitespace-nowrap">
        {totalMessages > 0
          ? `Mensajes ${start} a ${end} de ${totalMessages.toLocaleString()}`
          : "El buzon esta vacio"
        }
      </span>

      <input
        type="text"
        value={inputPage}
        onChange={handleInputChange}
        onKeyDown={handleInputSubmit}
        onBlur={() => setInputPage(page)}
        className="w-10 h-8 text-center text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded focus:outline-none focus:border-blue-400"
        data-testid="pagination-input"
      />

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Siguiente"
        data-testid="pagination-next"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
      <button
        onClick={() => onPageChange(totalPages)}
        disabled={page >= totalPages}
        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Ultima"
        data-testid="pagination-last"
      >
        <ChevronsRight className="w-5 h-5" />
      </button>
    </div>
  );
}
