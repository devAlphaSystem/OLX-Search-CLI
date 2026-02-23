/**
 * @fileoverview Core search library for OLX Brazil.
 * Provides functions to query OLX listing pages, extract structured listing data,
 * and enrich results with full listing details.
 * @module index
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const MARKETPLACE_DOMAIN = "www.olx.com.br";
const DEFAULT_LIMIT = 20;
const DEFAULT_TIMEOUT = 15000;
const DEFAULT_CONCURRENCY = 5;
const VALID_STATES = new Set(["ac", "al", "ap", "am", "ba", "ce", "df", "es", "go", "ma", "mt", "ms", "mg", "pa", "pb", "pr", "pe", "pi", "rj", "rn", "rs", "ro", "rr", "sc", "sp", "se", "to"]);

/**
 * Known OLX category slugs with their display names.
 * Keys are the `friendlyPath` used in the URL; values are human-readable labels.
 *
 * @type {Map<string, string>}
 */
const CATEGORIES = new Map([
  ["imoveis", "Imóveis"],
  ["imoveis/venda", "Venda - casas e apartamentos"],
  ["imoveis/aluguel", "Aluguel - casas e apartamentos"],
  ["imoveis/temporada", "Temporada"],
  ["imoveis/terrenos", "Terrenos, sítios e fazendas"],
  ["imoveis/comercio-e-industria", "Comércio e indústria"],
  ["imoveis/lancamentos", "Imóvel Novo"],
  ["autos-e-pecas", "Autos"],
  ["autos-e-pecas/carros-vans-e-utilitarios", "Carros, vans e utilitários"],
  ["autos-e-pecas/motos", "Motos"],
  ["autos-e-pecas/onibus", "Ônibus"],
  ["autos-e-pecas/caminhoes", "Caminhões"],
  ["autos-e-pecas/barcos-e-aeronaves", "Barcos e aeronaves"],
  ["autos-e-pecas/pecas-e-acessorios", "Autopeças"],
  ["autos-e-pecas/pecas-e-acessorios/carros-vans-e-utilitarios", "Peças para carros, vans e utilitários"],
  ["autos-e-pecas/pecas-e-acessorios/motos", "Peças para motos"],
  ["autos-e-pecas/pecas-e-acessorios/onibus", "Peças para ônibus"],
  ["autos-e-pecas/pecas-e-acessorios/caminhoes", "Peças para caminhões"],
  ["autos-e-pecas/pecas-e-acessorios/barcos-e-aeronaves", "Peças para barcos e aeronaves"],
  ["para-a-sua-casa", "Casa, Decoração e Utensílios"],
  ["para-a-sua-casa/cama-mesa-e-banho", "Tecidos de Cama, Mesa e Banho"],
  ["para-a-sua-casa/decoracoes-para-casa", "Decorações Para Casa"],
  ["para-a-sua-casa/casa-inteligente", "Casa Inteligente"],
  ["para-a-sua-casa/utensilios-para-cozinha", "Utensílios Para Cozinha"],
  ["para-a-sua-casa/utensilios-para-banheiro-e-limpeza", "Utensílios Para Banheiro e Limpeza"],
  ["para-a-sua-casa/iluminacao", "Iluminação"],
  ["para-a-sua-casa/seguranca-residencial", "Segurança Residencial"],
  ["para-a-sua-casa/jardinagem-e-plantas", "Jardinagem e Plantas"],
  ["para-a-sua-casa/area-externa", "Área Externa"],
  ["moveis", "Móveis"],
  ["moveis/camas-e-colchoes", "Camas e Colchões"],
  ["moveis/sofas-e-poltronas", "Sofás e Poltronas"],
  ["moveis/cadeiras-de-escritorio-e-gamer", "Cadeiras de Escritório e Gamer"],
  ["moveis/bancos-e-cadeiras", "Bancos e Cadeiras"],
  ["moveis/mesas", "Mesas"],
  ["moveis/escrivaninhas-e-penteadeiras", "Escrivaninhas e Penteadeiras"],
  ["moveis/racks-e-paineis", "Racks e Painéis"],
  ["moveis/armarios-e-guarda-roupas", "Armários e Guarda-Roupas"],
  ["moveis/moveis-para-organizacao", "Móveis Para Organização"],
  ["eletro", "Eletro"],
  ["eletro/ar-condicionados", "Ar-condicionados"],
  ["eletro/ventiladores-e-climatizadores", "Ventiladores e Climatizadores"],
  ["eletro/geladeiras-e-freezers", "Geladeiras e Freezers"],
  ["eletro/fogoes-e-fornos", "Fogões e Fornos"],
  ["eletro/maquinas-de-lavar-e-secadoras", "Máquinas de Lavar e Secadoras"],
  ["eletro/eletroportateis-para-cozinha-e-limpeza", "Eletroportáteis Para Cozinha e Limpeza"],
  ["eletro/eletroportateis-para-cuidados-pessoais", "Eletroportáteis Para Cuidados Pessoais"],
  ["materiais-de-construcao", "Materiais de Construção"],
  ["materiais-de-construcao/fundacao-e-estrutura", "Fundação e Estrutura"],
  ["materiais-de-construcao/alvenaria", "Alvenaria"],
  ["materiais-de-construcao/pisos-e-revestimentos", "Pisos e Revestimentos"],
  ["materiais-de-construcao/portas-e-janelas", "Portas e Janelas"],
  ["materiais-de-construcao/cubas-e-pias", "Cubas e Pias"],
  ["materiais-de-construcao/torneiras-duchas-e-vasos", "Torneiras, Duchas e Vasos"],
  ["materiais-de-construcao/instalacoes-eletricas-e-hidraulicas", "Instalações Elétricas e Hidráulicas"],
  ["materiais-de-construcao/ferramentas-de-construcao", "Ferramentas de Construção"],
  ["materiais-de-construcao/ferramentas-de-pintura", "Ferramentas de Pintura"],
  ["eletronicos-e-celulares", "Celulares e Telefonia"],
  ["celulares", "Celulares e Smartphones"],
  ["eletronicos-e-celulares/acessorios-de-celular", "Acessórios de Celular"],
  ["eletronicos-e-celulares/pecas-de-celular", "Peças de Celular"],
  ["eletronicos-e-celulares/smartwatches", "Smartwatches"],
  ["eletronicos-e-celulares/acessorios-para-smartwatch", "Acessórios Para Smartwatch"],
  ["eletronicos-e-celulares/telefonia-fixa-e-sem-fio", "Telefonia Fixa e Sem Fio"],
  ["informatica", "Informática"],
  ["informatica/computadores-e-desktops", "Computadores e Desktops"],
  ["informatica/notebooks", "Notebooks"],
  ["informatica/monitores", "Monitores"],
  ["informatica/perifericos-e-acessorios-de-computador", "Periféricos e Acessórios de Computador"],
  ["informatica/pecas-de-hardware", "Peças de Hardware"],
  ["informatica/armazenamento", "Armazenamento"],
  ["informatica/memoria-ram", "Memória RAM"],
  ["informatica/processadores", "Processadores"],
  ["informatica/placas-de-video", "Placas de Vídeo"],
  ["informatica/conectividade-e-dispositivos-de-rede", "Conectividade e Dispositivos de Rede"],
  ["informatica/tablets-e-readers", "Tablets e E-Readers"],
  ["games", "Games"],
  ["games/consoles-de-video-game", "Consoles de Vídeo Game"],
  ["games/jogos-de-video-game", "Jogos de Vídeo Game"],
  ["games/acessorios-de-video-game", "Peças e Acessórios de Vídeo Game"],
  ["tvs-e-video", "TVs e video"],
  ["tvs-e-video/tvs", "TVs"],
  ["tvs-e-video/acessorios-para-tv", "Peças e Acessórios para TV"],
  ["tvs-e-video/projetores-e-telas-de-projecao", "Projetores e Telas de Projeção"],
  ["tvs-e-video/dvd-blu-ray-video-cassete", "DVD, Blu-Ray e Vídeo Cassete"],
  ["tvs-e-video/dispositivos-de-streaming", "Dispositivos de Streaming"],
  ["audio", "Áudio"],
  ["audio/fones-de-ouvido", "Fones de Ouvido"],
  ["audio/aparelhos-de-som", "Aparelhos de Som"],
  ["audio/microfones-e-gravadores", "Microfones e Gravadores"],
  ["audio/equipamentos-e-acessorios-de-som", "Equipamentos e Acessórios de Som"],
  ["cameras-e-drones", "Câmeras e Drones"],
  ["cameras-e-filmadoras", "Câmeras e Filmadoras"],
  ["acessorios-para-cameras-e-filmadoras", "Acessórios para Câmeras e Filmadoras"],
  ["drones", "Drones"],
  ["moda-e-beleza", "Moda e beleza"],
  ["beleza-e-saude", "Beleza e Cuidados Pessoais"],
  ["roupas", "Roupas"],
  ["bolsas-malas-e-mochilas", "Bolsas, malas e mochilas"],
  ["bijouteria-relogios-e-acessorios", "Acessórios"],
  ["calcados", "Calçados"],
  ["comercio-e-escritorio", "Comércio"],
  ["comercio-e-escritorio/equipamentos", "Equipamentos Para Comércio"],
  ["comercio-e-escritorio/gastronomia", "Gastronomia e Hotelaria"],
  ["comercio-e-escritorio/equipamento-medico", "Equipamentos Médicos e Hospitalares"],
  ["comercio-e-escritorio/uniformes-epis", "Uniformes de Trabalho e EPIs"],
  ["comercio-e-escritorio/trailers-e-carrinhos-comerciais", "Trailers e carrinhos comerciais"],
  ["escritorio", "Escritório e Home Office"],
  ["escritorio/itens-para-escritorio", "Itens Para Escritório"],
  ["escritorio/cadeiras-de-escritorio", "Cadeiras de Escritório e Gamer"],
  ["escritorio/moveis-de-escritorio", "Móveis de Escritório"],
  ["escritorio/papelaria", "Papelaria"],
  ["musica-e-hobbies", "Música e hobbies"],
  ["instrumentos-musicais", "Instrumentos musicais"],
  ["cds-dvds", "CDs, DVDs etc"],
  ["livros-e-revistas", "Livros e revistas"],
  ["antiguidades", "Antiguidades"],
  ["hobbies-e-colecoes", "Hobbies e coleções"],
  ["esportes-e-lazer", "Esportes e Fitness"],
  ["ciclismo", "Ciclismo"],
  ["esportes-e-lazer/academia-e-exercicios", "Academia e Exercícios"],
  ["esportes-e-lazer/acampamento", "Acampamento"],
  ["esportes-e-lazer/esportes-sobre-rodas", "Esportes Sobre Rodas"],
  ["esportes-e-lazer/quadra-e-ao-ar-livre", "Esportes de Quadra e Ao Ar Livre"],
  ["esportes-e-lazer/esportes-aquaticos", "Esportes Aquáticos"],
  ["esportes-e-lazer/roupas-esportivas", "Roupas Esportivas"],
  ["esportes-e-lazer/calcados-esportivos", "Calçados Esportivos"],
  ["esportes-e-lazer/acessorios-de-ciclismo", "Acessórios de Ciclismo"],
  ["artigos-infantis", "Artigos infantis"],
  ["artigos-infantis/roupas-infantis", "Roupas Infantis"],
  ["artigos-infantis/calcados-infantis", "Calçados Infantis"],
  ["artigos-infantis/roupas-para-bebes", "Roupas para Bebês"],
  ["artigos-infantis/calcados-para-bebes", "Calçados Para Bebês"],
  ["artigos-infantis/brinquedos", "Brinquedos e Jogos"],
  ["artigos-infantis/maternidade-e-bebes", "Maternidade e Cuidados com o Bebê"],
  ["artigos-infantis/moveis-infantis", "Móveis Infantis"],
  ["animais-de-estimacao", "Animais de estimação"],
  ["animais-de-estimacao/cachorros", "Cachorros"],
  ["animais-de-estimacao/gatos", "Gatos"],
  ["animais-de-estimacao/acessorios", "Acessórios para pets"],
  ["animais-de-estimacao/roedores", "Roedores"],
  ["animais-de-estimacao/outros-animais", "Outros animais"],
  ["agro-e-industria", "Agro e indústria"],
  ["agro-e-industria/tratores-e-maquinas-agricolas", "Tratores e máquinas agrícolas"],
  ["agro-e-industria/maquinas-pesadas-para-construcao", "Máquinas pesadas para construção"],
  ["agro-e-industria/maquinas-para-producao-industrial", "Máquinas para produção industrial"],
  ["agro-e-industria/pecas-para-tratores-e-maquinas", "Peças para tratores e máquinas"],
  ["agro-e-industria/animais-para-agropecuaria", "Animais para agropecuária"],
  ["agro-e-industria/producao-rural", "Produção Rural"],
  ["agro-e-industria/outros-itens-para-agro-e-industria", "Outros itens para agro e indústria"],
  ["servicos", "Serviços"],
  ["vagas-de-emprego", "Vagas de emprego"],
]);

/**
 * Searches OLX and returns a structured result set.
 *
 * @param {string} query - The search query string.
 * @param {object} [options={}] - Search options.
 * @param {number} [options.limit=20] - Maximum number of items to return.
 * @param {number} [options.timeout=15000] - HTTP request timeout in milliseconds.
 * @param {'price_asc'|'price_desc'|'date'|'relevance'} [options.sort] - Sort order.
 * @param {number} [options.concurrency=5] - Max parallel detail requests per batch.
 * @param {string} [options.state] - Filter by Brazilian state(s). Single UF or comma-separated list (e.g. "sp", "sp,rj,mg").
 * @param {string} [options.category] - Category slug to filter, e.g. "celulares".
 * @param {boolean} [options.strict=false] - Whether to filter results that don't match all query terms in title, description, or properties.
 * @returns {Promise<{items: object[], query: object, pagination: object}>} Search result.
 * @throws {Error} If the page structure cannot be parsed.
 */
export async function search(query, options = {}) {
  const { limit = DEFAULT_LIMIT, timeout = DEFAULT_TIMEOUT, sort, concurrency = DEFAULT_CONCURRENCY, state, category, strict = false } = options;

  if (category && !CATEGORIES.has(category)) {
    const list = [...CATEGORIES.entries()].map(([slug, name]) => `  ${slug.padEnd(55)} ${name}`).join("\n");
    throw new Error(`Unknown category "${category}".\n\nValid categories:\n${list}\n\nUse --list-categories to see all options.`);
  }

  const stateList = state
    ? state
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : [];
  for (const s of stateList) {
    if (!VALID_STATES.has(s)) throw new Error(`Unknown state "${s}". Use a valid Brazilian UF (e.g. sp, rj, mg).`);
  }

  if (stateList.length > 1) {
    const settled = await Promise.allSettled(stateList.map((s) => search(query, { ...options, state: s, limit: strict ? limit * 3 : limit })));
    const seenIds = new Set();
    let merged = [];
    let totalSum = 0;
    let firstResultUrl = null;
    let selectedCategory = null;
    let pageSize = 50;
    const stateResults = [];
    for (const outcome of settled) {
      if (outcome.status !== "fulfilled") continue;
      const r = outcome.value;
      if (!firstResultUrl) {
        firstResultUrl = r.query.url;
        selectedCategory = r.query.category;
        pageSize = r.pagination.pageSize || 50;
      }
      totalSum += r.pagination.total || 0;
      stateResults.push(r.items);
    }
    const maxLen = Math.max(0, ...stateResults.map((arr) => arr.length));
    for (let i = 0; i < maxLen; i++) {
      for (const arr of stateResults) {
        if (i >= arr.length) continue;
        const item = arr[i];
        if (item.id && seenIds.has(item.id)) continue;
        if (item.id) seenIds.add(item.id);
        merged.push(item);
      }
    }
    if (strict) merged = merged.filter((item) => matchesQuery(item, query));
    if (sort === "price_asc") merged.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    else if (sort === "price_desc") merged.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    merged = merged.slice(0, limit);
    return {
      items: merged,
      query: { text: query, sort: sort || null, state: stateList.join(","), states: stateList, category: selectedCategory, strict, url: firstResultUrl },
      pagination: { total: totalSum, page: 1, pageSize, limit, maxPages: 20, resultsLimit: 20 * pageSize, capped: merged.length >= limit },
    };
  }

  const singleState = stateList[0] ?? null;
  const MAX_PAGES = 20;
  const firstUrl = buildUrl(query, { sort, domain: MARKETPLACE_DOMAIN, page: 1, state: singleState, category });
  const firstHtml = await fetchPage(firstUrl, timeout);
  const firstState = extractNextData(firstHtml);

  if (!firstState || !Array.isArray(firstState.ads)) {
    throw new Error("Could not extract search results. The page structure may have changed.");
  }

  const totalAvailable = firstState.totalOfAds ?? Infinity;
  const pageSize = firstState.pageSize || 50;

  const seenIds = new Set();
  let items = firstState.ads.map((ad) => parseAd(ad)).filter(Boolean);
  for (const item of items) if (item.id) seenIds.add(item.id);

  let currentPage = 1;
  while (items.length < limit && currentPage * pageSize < totalAvailable && currentPage < MAX_PAGES) {
    currentPage++;
    const pageUrl = buildUrl(query, { sort, domain: MARKETPLACE_DOMAIN, page: currentPage, state: singleState, category });
    const pageHtml = await fetchPage(pageUrl, timeout);
    const pageState = extractNextData(pageHtml);
    if (!pageState || !Array.isArray(pageState.ads) || pageState.ads.length === 0) break;
    const newItems = pageState.ads.map((ad) => parseAd(ad)).filter(Boolean);
    for (const item of newItems) {
      if (item.id && seenIds.has(item.id)) continue;
      if (item.id) seenIds.add(item.id);
      items.push(item);
    }
  }

  const capped = items.length >= limit || (currentPage >= MAX_PAGES && currentPage * pageSize < totalAvailable);

  if (strict) {
    const tokens = getQueryTokens(query);
    if (tokens.length > 0) items = items.filter((item) => matchesTokens(item, tokens));
  }

  if (sort === "price_asc") {
    items.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  } else if (sort === "price_desc") {
    items.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
  }

  items = items.slice(0, limit);

  if (items.length > 0) {
    const queue = items.filter((item) => item.permalink);
    for (let i = 0; i < queue.length; i += concurrency) {
      const batch = queue.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        batch.map(async (item) => {
          try {
            const html = await fetchPage(item.permalink, timeout);

            let ldJson = null;
            {
              const marker = 'application/ld+json">';
              const idx = html.indexOf(marker);
              if (idx >= 0) {
                const jsonStart = idx + marker.length;
                const jsonEnd = html.indexOf("</script>", jsonStart);
                if (jsonEnd >= 0) {
                  try {
                    ldJson = JSON.parse(html.slice(jsonStart, jsonEnd));
                  } catch {
                    ldJson = null;
                  }
                }
              }
            }

            let rscData = null;
            {
              const apIdx = html.indexOf('"adProperties"');
              if (apIdx >= 0) {
                let braceDepth = 0;
                let start = apIdx;
                for (let k = apIdx; k >= 0; k--) {
                  if (html[k] === "}") braceDepth++;
                  if (html[k] === "{") {
                    braceDepth--;
                    if (braceDepth < 0) {
                      start = k;
                      break;
                    }
                  }
                }
                braceDepth = 0;
                let end = start;
                for (let k = start; k < html.length; k++) {
                  if (html[k] === "{") braceDepth++;
                  if (html[k] === "}") {
                    braceDepth--;
                    if (braceDepth === 0) {
                      end = k + 1;
                      break;
                    }
                  }
                }
                try {
                  rscData = JSON.parse(html.slice(start, end));
                } catch {
                  rscData = null;
                }
              }
            }

            const description = ldJson?.description
              ? ldJson.description
                  .replace(/<br\s*\/?>/gi, "\n")
                  .replace(/<[^>]+>/g, "")
                  .trim()
              : null;
            const images =
              ldJson?.image?.length > 0
                ? ldJson.image
                    .map((img) => ({
                      url: img.contentUrl || img.url || (typeof img === "string" ? img : null),
                      urlWebp: null,
                    }))
                    .filter((img) => img.url)
                : null;
            const attributes = rscData?.adProperties?.filter((p) => p.name !== "category").map((p) => ({ name: p.label || p.name, value: p.value })) || null;
            const sellerName = rscData?.adDetail?.sellerName || null;

            return {
              description,
              images: images && images.length > 0 ? images : null,
              attributes: attributes && attributes.length > 0 ? attributes : null,
              sellerName,
            };
          } catch {
            return null;
          }
        }),
      );

      for (let j = 0; j < batch.length; j++) {
        const result = results[j];
        if (result.status === "fulfilled" && result.value) Object.assign(batch[j], result.value);
      }
    }
  }

  return {
    items,
    query: {
      text: query,
      sort: sort || null,
      state: singleState,
      states: stateList,
      category: firstState.selectedCategoryCode || category || null,
      strict,
      url: firstUrl,
    },
    pagination: {
      total: firstState.totalOfAds || items.length,
      page: 1,
      pageSize,
      limit,
      maxPages: MAX_PAGES,
      resultsLimit: MAX_PAGES * pageSize,
      capped,
    },
  };
}

/**
 * Fetches and returns the raw `pageProps` object from an OLX listing page
 * without any normalisation or filtering. Useful for debugging.
 *
 * @param {string} query - The search query string.
 * @param {object} [options={}] - Request options.
 * @param {number} [options.timeout=15000] - HTTP request timeout in milliseconds.
 * @param {'price_asc'|'price_desc'|'date'|'relevance'} [options.sort] - Sort order.
 * @param {string} [options.state] - Brazilian state filter (UF).
 * @param {string} [options.category] - Category slug filter.
 * @returns {Promise<object>} The raw pageProps object extracted from the page.
 * @throws {Error} If data cannot be extracted.
 */
export async function searchRaw(query, options = {}) {
  const { timeout = DEFAULT_TIMEOUT, sort, state, category } = options;

  if (category && !CATEGORIES.has(category)) {
    const list = [...CATEGORIES.entries()].map(([slug, name]) => `  ${slug.padEnd(55)} ${name}`).join("\n");
    throw new Error(`Unknown category "${category}".\n\nValid categories:\n${list}\n\nUse --list-categories to see all options.`);
  }

  const url = buildUrl(query, { sort, domain: MARKETPLACE_DOMAIN, page: 1, state, category });
  const html = await fetchPage(url, timeout);
  const state_ = extractNextData(html);

  if (!state_) {
    throw new Error("Could not extract page data from OLX.");
  }

  return state_;
}

/**
 * Returns the known OLX categories as an array of `{slug, name}` objects.
 *
 * @returns {{slug: string, name: string}[]} Array of category entries.
 */
export function getCategories() {
  return [...CATEGORIES.entries()].map(([slug, name]) => ({ slug, name }));
}

/**
 * Constructs the OLX search URL for a given query and filters.
 *
 * @param {string} query - The search query.
 * @param {object} params - URL parameters.
 * @param {'price_asc'|'price_desc'|'date'|undefined} params.sort - Sort order.
 * @param {string} params.domain - The OLX domain.
 * @param {number} [params.page=1] - Page number (1-based).
 * @param {string} [params.state] - Brazilian state (UF) for regional filter.
 * @param {string} [params.category] - Category slug.
 * @returns {string} The fully qualified search URL.
 */
function buildUrl(query, { sort, domain, page = 1, state, category }) {
  let path = "";

  if (category && state) {
    path = `/${category}/estado-${state.toLowerCase()}`;
  } else if (category) {
    path = `/${category}`;
  } else if (state) {
    path = `/estado-${state.toLowerCase()}`;
  } else {
    path = "/brasil";
  }

  const params = new URLSearchParams();
  params.set("q", query);

  if (page > 1) params.set("o", String(page));

  if (sort === "price_asc") params.set("sp", "1");
  else if (sort === "price_desc") params.set("sp", "2");
  else if (sort === "date") params.set("sf", "1");

  return `https://${domain}${path}?${params.toString()}`;
}

/**
 * Fetches the HTML content of a URL using browser-like headers.
 *
 * @param {string} url - The URL to fetch.
 * @param {number} timeout - Request timeout in milliseconds.
 * @returns {Promise<string>} The response body as a UTF-8 string.
 * @throws {Error} If the HTTP response status is not OK.
 */
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate",
  "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

const BROWSER_HEADERS_ENTRIES = Object.entries(BROWSER_HEADERS);

async function fetchWithFetch(url, timeout) {
  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(timeout),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.text();
}

async function fetchWithCurl(url, timeout) {
  const timeoutSec = Math.max(1, Math.ceil(timeout / 1000));
  const args = ["-sS", "-L", "--max-time", String(timeoutSec), "--compressed", "-w", "\n%{http_code}"];
  for (const [key, value] of BROWSER_HEADERS_ENTRIES) {
    args.push("-H", `${key}: ${value}`);
  }
  args.push(url);

  const { stdout } = await execFileAsync("curl", args, { maxBuffer: 10 * 1024 * 1024 });
  const lastNewline = stdout.lastIndexOf("\n");
  const statusCode = parseInt(stdout.slice(lastNewline + 1).trim(), 10);
  const body = stdout.slice(0, lastNewline);
  if (statusCode >= 400) throw new Error(`HTTP ${statusCode}`);
  return body;
}

async function fetchPage(url, timeout) {
  try {
    return await fetchWithFetch(url, timeout);
  } catch {
    return fetchWithCurl(url, timeout);
  }
}

/**
 * Extracts the `pageProps` object from OLX's `__NEXT_DATA__` script tag.
 *
 * @param {string} html - Raw HTML string of the page.
 * @returns {object|null} Parsed pageProps object, or `null` if not found.
 */
export function extractNextData(html) {
  const marker = '<script id="__NEXT_DATA__" type="application/json">';
  const idx = html.indexOf(marker);
  if (idx < 0) return null;

  const jsonStart = idx + marker.length;
  const jsonEnd = html.indexOf("</script>", jsonStart);
  if (jsonEnd < 0) return null;

  try {
    const data = JSON.parse(html.slice(jsonStart, jsonEnd));
    return data?.props?.pageProps || null;
  } catch {
    return null;
  }
}

/**
 * Normalises a string for fuzzy matching: lowercases, strips accents and
 * collapses whitespace.
 *
 * @param {string} str - Input string.
 * @returns {string} Normalised string.
 */
function normalize(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Words too common to be meaningful query filters. */
const STOP_WORDS = new Set(["de", "da", "do", "das", "dos", "e", "ou", "em", "com", "para", "por", "um", "uma", "o", "a", "os", "as", "no", "na", "nos", "nas", "the", "and", "or", "for", "in", "of", "to", "with"]);

/**
 * Checks whether an item matches ALL significant terms in the search query.
 * Builds a text corpus from title, description and properties, then verifies
 * that every non-stop-word query token appears in the corpus.
 *
 * @param {object} item - A normalised item object.
 * @param {string} query - The original search query string.
 * @returns {boolean} `true` if the item matches all query terms.
 */
function getQueryTokens(query) {
  return normalize(query)
    .split(" ")
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function matchesTokens(item, tokens) {
  if (tokens.length === 0) return true;

  let corpus = normalize(item.title || "");
  if (item.description) corpus += " " + normalize(item.description);
  if (item.properties) {
    for (const prop of item.properties) {
      corpus += " " + normalize(prop.value || "");
    }
  }

  return tokens.every((token) => corpus.includes(token));
}

function matchesQuery(item, query) {
  return matchesTokens(item, getQueryTokens(query));
}

/**
 * Parses the price string from OLX into a numeric value.
 * OLX prices come as strings like "R$ 3.899" or "R$ 1.200".
 *
 * @param {string|null} priceStr - The price string from OLX.
 * @returns {number|null} Numeric price, or null if not parseable.
 */
function parsePrice(priceStr) {
  if (!priceStr || typeof priceStr !== "string") return null;
  const cleaned = priceStr
    .replace(/[^\d.,]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Normalises a single raw OLX ad into a structured item object.
 *
 * @param {object} ad - A raw ad entry from `pageProps.ads`.
 * @returns {object|null} Normalised item object, or `null` if the entry should be skipped.
 */
function parseAd(ad) {
  if (!ad) return null;

  const title = ad.subject || ad.title || "";
  if (!title) return null;

  const price = parsePrice(ad.priceValue || ad.price);
  const oldPrice = parsePrice(ad.oldPrice);

  let discountPercent = null;
  if (oldPrice && price && oldPrice > price) {
    discountPercent = Math.round(((oldPrice - price) / oldPrice) * 100);
  }

  const images =
    ad.images
      ?.map((img) => ({
        url: img.original || img.originalWebp || null,
        urlWebp: img.originalWebp || null,
      }))
      .filter((img) => img.url) || [];

  const thumbnail = images[0]?.url || null;

  const properties =
    ad.properties
      ?.filter((p) => p.name !== "category")
      .map((p) => ({
        name: p.label || p.name,
        value: p.value,
      })) || [];

  const location = ad.location || null;
  const locationDetails = ad.locationDetails || null;

  const permalink = ad.url || ad.friendlyUrl || "";
  const date = ad.date || ad.origListTime || null;

  const professionalAd = ad.professionalAd || false;

  const olxPay = ad.olxPay?.enabled || false;
  const olxDelivery = ad.olxDelivery?.enabled || false;

  const categoryName = ad.categoryName || ad.category || null;
  const categoryId = ad.listingCategoryId || ad.searchCategoryLevelOne || null;

  return {
    id: ad.listId || null,
    title,
    price,
    currency: "BRL",
    oldPrice,
    discountPercent,
    location,
    locationDetails: locationDetails
      ? {
          municipality: locationDetails.municipality || null,
          uf: locationDetails.uf || null,
          neighbourhood: locationDetails.neighbourhood || null,
        }
      : null,
    date: date ? new Date(date * 1000).toISOString() : null,
    dateTimestamp: date || null,
    professionalAd,
    thumbnail,
    images: images.length > 0 ? images : null,
    imageCount: ad.imageCount || images.length,
    videoCount: ad.videoCount || 0,
    permalink,
    category: categoryName,
    categoryId: categoryId ? String(categoryId) : null,
    properties: properties.length > 0 ? properties : null,
    olxPay,
    olxDelivery,
    isFeatured: ad.isFeatured || false,
    priceReduction: ad.priceReductionBadge || false,
    description: null,
    attributes: null,
    sellerName: null,
  };
}
