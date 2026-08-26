import type { ReactNode } from 'react';

interface CoachDataTableColumn<T> {
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right';
}

interface CoachDataTableProps<T> {
  columns: CoachDataTableColumn<T>[];
  rows: T[];
  emptyLabel?: string;
  rowKey: (row: T) => string;
}

export function CoachDataTable<T>({
  columns,
  rows,
  emptyLabel = 'No data yet.',
  rowKey,
}: CoachDataTableProps<T>) {
  if (rows.length === 0) {
    return <p className="text-sm text-secondary">{emptyLabel}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-secondary">
            {columns.map((column) => (
              <th
                key={column.header}
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
              {columns.map((column) => (
                <td
                  key={column.header}
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
