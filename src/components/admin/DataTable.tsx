import { useState, useMemo } from 'react';
import LoadingSkeleton from './LoadingSkeleton';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  pageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyMessage?: string;
}

type SortDir = 'asc' | 'desc';

function getField<T>(row: T, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}

export default function DataTable<T extends object>({
  columns,
  data,
  pageSize = 10,
  searchable = false,
  searchPlaceholder = 'Search…',
  onRowClick,
  loading = false,
  emptyMessage = 'No data found.',
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!query.trim()) return data;
    const q = query.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const val = getField(row, col.key as string);
        return typeof val === 'string' && val.toLowerCase().includes(q);
      })
    );
  }, [data, query, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = getField(a, sortKey);
      const bv = getField(b, sortKey);
      if (av === bv) return 0;
      const cmp = String(av) < String(bv) ? -1 : 1;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageData = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  }

  function handleSearch(val: string) {
    setQuery(val);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-3">
      {searchable && (
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full max-w-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#FFD700]/50 transition-colors"
        />
      )}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              {columns.map((col) => (
                <th
                  key={col.key as string}
                  onClick={() => col.sortable && handleSort(col.key as string)}
                  className={`px-4 py-3 text-left text-xs uppercase tracking-widest text-white/50 select-none ${
                    col.sortable ? 'cursor-pointer hover:text-white/80 transition-colors' : ''
                  }`}
                >
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    <span className="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-4">
                  <LoadingSkeleton rows={pageSize} />
                </td>
              </tr>
            ) : pageData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-white/30 text-sm"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageData.map((row, i) => (
                <tr
                  key={i}
                  onClick={() => onRowClick?.(row)}
                  className={`border-b border-white/5 transition-colors ${
                    onRowClick ? 'cursor-pointer hover:bg-white/5' : ''
                  }`}
                >
                  {columns.map((col) => (
                    <td key={col.key as string} className="px-4 py-3 text-white/80">
                      {col.render
                        ? col.render(row)
                        : String(getField(row, col.key as string) ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-white/40">
        <span>
          Page {safePage} of {totalPages} ({sorted.length} total)
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white/70"
          >
            Previous
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white/70"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
