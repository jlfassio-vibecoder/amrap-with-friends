import type { ReactNode } from 'react';

interface CoachDataTableColumn<T> {
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right';
}

/** Approximate row height for scroll max-height (text-sm + py-2). */
const ROW_HEIGHT_REM = 2.25;
const HEADER_HEIGHT_REM = 2.5;

interface CoachDataTableProps<T> {
  columns: CoachDataTableColumn<T>[];
  rows: T[];
  emptyLabel?: string;
  rowKey: (row: T) => string;
  /** When set and rows exceed this count, the table body scrolls vertically. */
  scrollAfterRows?: number;
}

export function CoachDataTable<T>({
  columns,
  rows,
  emptyLabel = 'No data yet.',
  rowKey,
  scrollAfterRows,
}: CoachDataTableProps<T>) {
  if (rows.length === 0) {
    return <p className="text-sm text-secondary">{emptyLabel}</p>;
  }

  const shouldScroll =
    scrollAfterRows != null && rows.length > scrollAfterRows;
  const scrollMaxHeight = shouldScroll
    ? `${HEADER_HEIGHT_REM + scrollAfterRows * ROW_HEIGHT_REM}rem`
    : undefined;

  return (
    <div
      className={shouldScroll ? 'overflow-y-auto overflow-x-auto' : 'overflow-x-auto'}
      style={shouldScroll ? { maxHeight: scrollMaxHeight } : undefined}
    >
      <table className="w-full text-sm">
        <thead className={shouldScroll ? 'sticky top-0 z-[1] bg-inherit' : undefined}>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-secondary">
            {columns.map((column, columnIndex) => (
              <th
                key={columnIndex}
                className={column.align === 'right' ? 'py-2 pr-2 text-right' : 'py-2 pr-2'}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-border/50">
              {columns.map((column, columnIndex) => (
                <td
                  key={columnIndex}
                  className={
                    column.align === 'right'
                      ? 'py-2 pr-2 text-right tabular-nums'
                      : 'py-2 pr-2'
                  }
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
