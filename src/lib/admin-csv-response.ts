import { NextResponse } from 'next/server';

/** UTF-8 BOM + CRLF lines; dated filename. */
export function utf8CsvDownloadResponse(lines: string[], filenameBase: string): NextResponse {
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${filenameBase}-${date}.csv`;
  const body = `\uFEFF${lines.join('\r\n')}\r\n`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
