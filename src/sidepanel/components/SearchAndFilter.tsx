import { ListFilterPlus, Search, X } from 'lucide-react';
import React, { useState } from 'react';
import { Tooltip } from './Tooltip';

export interface FilterOption {
  value: string;
  label: string;
}

interface SearchAndFilterProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedDomain: string;
  onDomainChange: (value: string) => void;
  domains: string[];
  filters?: {
    [key: string]: {
      label: string;
      options: FilterOption[];
    };
  };
  selectedFilters?: {
    [key: string]: string;
  };
  onFilterChange?: (filterKey: string, value: string) => void;
  placeholder?: string;
  showResultCount?: boolean;
  totalResults?: number;
  filteredResults?: number;
}

export const SearchAndFilter: React.FC<SearchAndFilterProps> = ({
  searchTerm,
  onSearchChange,
  selectedDomain,
  onDomainChange,
  domains,
  filters,
  selectedFilters,
  onFilterChange,
  placeholder = 'Search...',
  showResultCount = true,
  totalResults = 0,
  filteredResults = 0,
}) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const handleClearSearch = () => {
    onSearchChange('');
  };

  const handleClearDomain = () => {
    onDomainChange('');
  };

  const handleClearFilter = (filterKey: string) => {
    onFilterChange?.(filterKey, '');
  };

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg shadow-sm">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 pr-10 py-2 w-full border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searchTerm && (
          <button
            onClick={handleClearSearch}
            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {/* Advanced Filters Toggle */}
        <button
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
        >
          <Tooltip content={chrome.i18n.getMessage('filter_options')}>
            <ListFilterPlus color={isAdvancedOpen ? 'blue' : 'gray'} className="h-4 w-4" />
          </Tooltip>
        </button>
      </div>

      {/* Advanced Filters */}
      {isAdvancedOpen && (
        <div className="space-y-4">
          {/* Domain Filter */}
          {domains && domains.length > 0 && (
            <div className="relative">
              <label className="block text-smfont-medium text-gray-700 mb-1">Domain</label>
              <select
                value={selectedDomain}
                onChange={(e) => onDomainChange(e.target.value)}
                className="w-full p-2 pr-8 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Domains</option>
                {domains.map((domain) => (
                  <option key={domain} value={domain}>
                    {domain}
                  </option>
                ))}
              </select>
              {selectedDomain && (
                <button
                  onClick={handleClearDomain}
                  className="absolute right-2 top-8 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {/* Additional Filters */}
          {filters &&
            Object.entries(filters).map(([key, filter]) => (
              <div key={key} className="relative">
                <label className="block text-smfont-medium text-gray-700 mb-1">
                  {filter.label}
                </label>
                <select
                  value={selectedFilters?.[key] || ''}
                  onChange={(e) => onFilterChange?.(key, e.target.value)}
                  className="w-full p-2 pr-8 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All {filter.label}</option>
                  {filter.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {selectedFilters?.[key] && (
                  <button
                    onClick={() => handleClearFilter(key)}
                    className="absolute right-2 top-8 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Results Counter */}
      {showResultCount && (
        <div className="text-gray-600">
          {filteredResults} / {totalResults} entries
        </div>
      )}

      {/* Active Filters */}
      {(searchTerm || selectedDomain || Object.values(selectedFilters || {}).some(Boolean)) && (
        <div className="flex flex-wrap gap-2">
          {searchTerm && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-smbg-blue-100 text-blue-800">
              Search: {searchTerm}
              <button
                onClick={handleClearSearch}
                className="ml-2 text-blue-600 hover:text-blue-800"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {selectedDomain && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-smbg-green-100 text-green-800">
              Domain: {selectedDomain}
              <button
                onClick={handleClearDomain}
                className="ml-2 text-green-600 hover:text-green-800"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {selectedFilters &&
            Object.entries(selectedFilters).map(([key, value]) =>
              value ? (
                <span
                  key={key}
                  className="inline-flex items-center px-3 py-1 rounded-full text-smbg-purple-100 text-purple-800"
                >
                  {filters?.[key].label}:{' '}
                  {filters?.[key].options.find((opt) => opt.value === value)?.label || value}
                  <button
                    onClick={() => handleClearFilter(key)}
                    className="ml-2 text-purple-600 hover:text-purple-800"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ) : null
            )}
        </div>
      )}
    </div>
  );
};

export default SearchAndFilter;
