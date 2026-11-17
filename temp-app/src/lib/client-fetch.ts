import axios from 'axios';

export interface FetchFullDatasetOptions {
  forceRefresh?: boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Helper to fetch a large dataset page-by-page from the client-side.
 * It immediately emits the first page to allow fast initial rendering,
 * and then loads the remaining pages in resilient batches with retries,
 * updating the UI progressively after every batch.
 *
 * @param url The API route endpoint (e.g. '/api/gestor/cooperados')
 * @param onUpdate Optional callback called whenever a new batch of pages finishes loading.
 * @param options Optional settings such as forceRefresh cache-busting.
 */
export async function fetchFullDataset<T>(
  url: string,
  onUpdate?: (data: T[]) => void,
  options?: FetchFullDatasetOptions
): Promise<T[]> {
  const limit = 100;
  const batchSize = 6;
  const maxRetries = 2;

  const buildPageUrl = (cursor: number) => {
    const sep = url.includes('?') ? '&' : '?';
    const cacheBuster = options?.forceRefresh ? `&_t=${Date.now()}` : '';
    return `${url}${sep}cursor=${cursor}&limit=${limit}${cacheBuster}`;
  };

  const fetchPage = async (cursor: number, attempt = 0): Promise<{ results: T[]; remaining: number }> => {
    try {
      const res = await axios.get(buildPageUrl(cursor));
      if (!res.data?.success) {
        throw new Error(`Failed to fetch page at cursor=${cursor} from ${url}`);
      }
      const rawData = res.data.data;
      const isArray = Array.isArray(rawData);
      const results: T[] = isArray ? rawData : (rawData?.results || []);
      const remaining: number = isArray ? 0 : (rawData?.remaining || 0);
      return { results, remaining };
    } catch (error) {
      if (attempt < maxRetries) {
        await sleep(350 * (attempt + 1));
        return fetchPage(cursor, attempt + 1);
      }
      throw error;
    }
  };

  const firstPage = await fetchPage(0);
  let accumulated: T[] = [...firstPage.results];

  if (onUpdate) {
    onUpdate([...accumulated]);
  }

  if (firstPage.remaining > 0) {
    const totalPages = Math.ceil(firstPage.remaining / limit);

    for (let start = 1; start <= totalPages; start += batchSize) {
      const end = Math.min(start + batchSize - 1, totalPages);
      const batchPromises: Promise<T[]>[] = [];

      for (let pageIdx = start; pageIdx <= end; pageIdx++) {
        const nextCursor = pageIdx * limit;
        batchPromises.push(fetchPage(nextCursor).then((page) => page.results));
      }

      const settled = await Promise.allSettled(batchPromises);
      let batchHadNewData = false;

      for (const item of settled) {
        if (item.status === 'fulfilled') {
          if (item.value.length > 0) {
            accumulated = accumulated.concat(item.value);
            batchHadNewData = true;
          }
        } else {
          console.error(`Error loading background page for ${url}:`, item.reason);
        }
      }

      if (onUpdate && batchHadNewData) {
        onUpdate([...accumulated]);
      }
    }
  }

  return accumulated;
}
