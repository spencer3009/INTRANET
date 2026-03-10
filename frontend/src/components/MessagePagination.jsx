import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

const PER_PAGE = 50;

export default function MessagePagination({ page, totalPages, totalMessages, onPageChange }) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * PER_PAGE + 1;
  const end = Math.min(page * PER_PAGE, totalMessages);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50 flex-shrink-0" data-testid="message-pagination">
      <p className="text-xs text-gray-500">
        <span className="font-medium text-gray-700">{start}</span> a <span className="font-medium text-gray-700">{end}</span> de <span className="font-medium text-gray-700">{totalMessages.toLocaleString()}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Primera"
          data-testid="pagination-first"
        >
          <ChevronsLeft className="w-4 h-4 text-gray-600" />
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Anterior"
          data-testid="pagination-prev"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <span className="px-3 py-1 text-sm font-medium text-gray-700">
          {page} <span className="text-gray-400 hidden sm:inline">/ {totalPages}</span>
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Siguiente"
          data-testid="pagination-next"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Ultima"
          data-testid="pagination-last"
        >
          <ChevronsRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>
    </div>
  );
}
