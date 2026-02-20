import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, X, User } from "lucide-react";

/**
 * Combobox - Searchable select with custom rendering
 * 
 * @param {Object} props
 * @param {Array} props.options - Array of options: { id, label, sublabel?, image?, color? }
 * @param {string} props.value - Selected value (id)
 * @param {Function} props.onChange - Callback when selection changes
 * @param {string} props.placeholder - Placeholder text
 * @param {string} props.searchPlaceholder - Search input placeholder
 * @param {string} props.label - Label text
 * @param {boolean} props.required - Is required
 * @param {boolean} props.disabled - Is disabled
 * @param {string} props.emptyMessage - Message when no options
 */
export function Combobox({
  options = [],
  value,
  onChange,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  label,
  required = false,
  disabled = false,
  emptyMessage = "No hay opciones disponibles"
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Get selected option
  const selectedOption = options.find(opt => opt.id === value);

  // Filter options by search
  const filteredOptions = options.filter(opt => 
    opt.label?.toLowerCase().includes(search.toLowerCase()) ||
    opt.sublabel?.toLowerCase().includes(search.toLowerCase())
  );

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (option) => {
    onChange(option.id);
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div className="relative" ref={containerRef}>
      {label && (
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between text-left transition-all ${
          disabled ? "opacity-50 cursor-not-allowed" : "hover:border-slate-300"
        } ${isOpen ? "ring-2 ring-blue-500 border-blue-500" : ""}`}
      >
        {selectedOption ? (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Image or Color circle */}
            {selectedOption.image ? (
              <img 
                src={selectedOption.image} 
                alt={selectedOption.label}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : selectedOption.color ? (
              <div 
                className="w-8 h-8 rounded-full flex-shrink-0"
                style={{ backgroundColor: selectedOption.color }}
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-slate-500" />
              </div>
            )}
            {/* Fallback avatar (hidden by default) */}
            <div className="w-8 h-8 rounded-full bg-slate-200 items-center justify-center flex-shrink-0 hidden">
              <User className="w-4 h-4 text-slate-500" />
            </div>
            
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-800 truncate">{selectedOption.label}</p>
              {selectedOption.sublabel && (
                <p className="text-xs text-slate-500 truncate">{selectedOption.sublabel}</p>
              )}
            </div>
          </div>
        ) : (
          <span className="text-slate-400">{placeholder}</span>
        )}

        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {selectedOption && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-slate-200 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-6 text-center text-slate-500 text-sm">
                {search ? "No se encontraron resultados" : emptyMessage}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-blue-50 transition-colors text-left ${
                    value === option.id ? "bg-blue-50" : ""
                  }`}
                >
                  {/* Image or Color circle */}
                  {option.image ? (
                    <img 
                      src={option.image} 
                      alt={option.label}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '';
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : option.color ? (
                    <div 
                      className="w-10 h-10 rounded-full flex-shrink-0"
                      style={{ backgroundColor: option.color }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-slate-500" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${value === option.id ? "text-blue-700" : "text-slate-800"}`}>
                      {option.label}
                    </p>
                    {option.sublabel && (
                      <p className="text-xs text-slate-500 truncate">{option.sublabel}</p>
                    )}
                  </div>

                  {/* Check mark for selected */}
                  {value === option.id && (
                    <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Combobox;
