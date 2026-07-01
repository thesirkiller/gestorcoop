import axios from 'axios';

/**
 * Helper to fetch a large dataset page-by-page from the client-side.
 * It immediately returns the first page to allow fast initial rendering,
 * and then continues loading the rest in the background.
 *
 * @param url The API route endpoint (e.g. '/api/gestor/cooperados')
 * @param onUpdate Optional callback called whenever a new page or batch of pages finishes loading.
 */
export async function fetchFullDataset<T>(
  url: string,
  onUpdate?: (data: T[]) => void
): Promise<T[]> {
  const limit = 100;
  const initialRes = await axios.get(`${url}?cursor=0&limit=${limit}`);
  if (!initialRes.data.success) {
    throw new Error(`Failed to fetch initial page from ${url}`);
  }

  const { results, remaining } = initialRes.data.data;
  let accumulated: T[] = [...(results || [])];

  if (onUpdate) {
    onUpdate(accumulated);
  }

  if (remaining > 0) {
    const totalPages = Math.ceil(remaining / limit);
    const promises: Promise<T[]>[] = [];

    for (let i = 1; i <= totalPages; i++) {
      const nextCursor = i * limit;
      promises.push(
        axios
          .get(`${url}?cursor=${nextCursor}&limit=${limit}`)
          .then((res) => (res.data.data.results || []) as T[])
      );
    }

    try {
      const pagesResults = await Promise.all(promises);
      for (const pageResults of pagesResults) {
        accumulated = accumulated.concat(pageResults);
      }

      if (onUpdate) {
        onUpdate(accumulated);
      }
    } catch (error) {
      console.error(`Error loading background pages for ${url}:`, error);
    }
  }

  return accumulated;
}
