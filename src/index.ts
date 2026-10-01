import { Env, ContentResponse } from './types';
import { slugToTabName } from './slug';
import { parseCSV, extractSheetRows, transformSheetRows } from './parser';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      ...CORS_HEADERS,
      ...headers,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // Health / Root info endpoint
    if (url.pathname === '/' || url.pathname === '/api') {
      return jsonResponse({
        status: 'ok',
        name: 'robert-content-api',
        version: '1.0.0',
        endpoints: ['/api/content/:slug'],
      });
    }

    // Match /api/content/:slug
    const contentPrefix = '/api/content/';
    if (!url.pathname.startsWith(contentPrefix)) {
      return jsonResponse(
        {
          status: 'error',
          message: 'Not Found',
        },
        404
      );
    }

    // Validate HTTP method: only GET is allowed
    if (request.method !== 'GET') {
      return jsonResponse(
        {
          status: 'error',
          message: 'Method Not Allowed',
        },
        405,
        { Allow: 'GET, OPTIONS' }
      );
    }

    const rawSlug = url.pathname.slice(contentPrefix.length).trim();
    const slug = decodeURIComponent(rawSlug).replace(/\/+$/, '');

    if (!slug) {
      return jsonResponse(
        {
          status: 'error',
          message: 'Slug parameter is required',
        },
        400
      );
    }

    const sheetId = env.GOOGLE_SHEET_ID;
    if (!sheetId) {
      return jsonResponse(
        {
          status: 'error',
          message: 'GOOGLE_SHEET_ID environment variable is missing',
        },
        500
      );
    }

    const tabName = slugToTabName(slug);
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(tabName)}`;

    try {
      const response = await fetch(gvizUrl, {
        headers: {
          'User-Agent': 'robert-content-api/1.0',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return jsonResponse(
            {
              status: 'error',
              message: 'Suburb content not found',
              slug,
            },
            404
          );
        }

        return jsonResponse(
          {
            status: 'error',
            message: 'Failed to fetch content from Google Sheets',
            slug,
          },
          502
        );
      }

      const csvText = await response.text();

      // Check if Google returned an HTML error or gviz error response
      if (
        csvText.trim().startsWith('<!DOCTYPE') ||
        csvText.trim().startsWith('<html') ||
        csvText.includes('google.visualization.Query.setResponse') ||
        csvText.includes('"status":"error"')
      ) {
        return jsonResponse(
          {
            status: 'error',
            message: 'Suburb content not found',
            slug,
          },
          404
        );
      }

      const matrix = parseCSV(csvText);
      const rows = extractSheetRows(matrix);

      if (rows.length === 0) {
        return jsonResponse(
          {
            status: 'error',
            message: 'Suburb content not found',
            slug,
          },
          404
        );
      }

      const content = transformSheetRows(rows);

      if (Object.keys(content).length === 0) {
        return jsonResponse(
          {
            status: 'error',
            message: 'Suburb content not found',
            slug,
          },
          404
        );
      }

      const result: ContentResponse = {
        status: 'success',
        slug,
        content,
      };

      return jsonResponse(result, 200);
    } catch (error) {
      return jsonResponse(
        {
          status: 'error',
          message: 'Failed to fetch content from Google Sheets',
          slug,
          details: error instanceof Error ? error.message : String(error),
        },
        502
      );
    }
  },
};
