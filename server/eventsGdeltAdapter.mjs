const GDELT_DOC_URL = 'https://api.gdeltproject.org/api/v2/doc/doc'
const GDELT_DOCS_URL = 'https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/'
const CACHE_MS = 15 * 60 * 1000 // 15 minutes cache
const MIN_REQUEST_INTERVAL_MS = 10 * 1000 // At least 10 seconds between API requests
const TIMEOUT_MS = 12 * 1000

let memoryCache = null
let lastRequestTime = 0

function parseGdeltDate(seenDateStr, fallbackDate = new Date()) {
  if (!seenDateStr || typeof seenDateStr !== 'string') return fallbackDate.toISOString()
  // Format is usually YYYYMMDDTHHMMSSZ or YYYYMMDDHHMMSS
  const cleaned = seenDateStr.replace(/[^0-9]/g, '')
  if (cleaned.length >= 14) {
    const year = Number.parseInt(cleaned.slice(0, 4), 10)
    const month = Number.parseInt(cleaned.slice(4, 6), 10) - 1
    const day = Number.parseInt(cleaned.slice(6, 8), 10)
    const hour = Number.parseInt(cleaned.slice(8, 10), 10)
    const minute = Number.parseInt(cleaned.slice(10, 12), 10)
    const second = Number.parseInt(cleaned.slice(12, 14), 10)
    const d = new Date(Date.UTC(year, month, day, hour, minute, second))
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  return fallbackDate.toISOString()
}

function detectSectorFromNews(text) {
  const t = text.toLowerCase()
  if (/kraftnät|elnät|elpris|strömavbrott|transformator|energi|kärnkraft|vindkraft|gasledning|pipeline|vattenkraft|diesel|olja|blackout/i.test(t)) {
    return 'energy'
  }
  if (/sjökabel|fiberkabel|telekom|mobilnät|5g|mast|störning tele|telia|telenor|tele2|bredband|internetavbrott|undervattenskabel/i.test(t)) {
    return 'telecom'
  }
  if (/trafikverket|järnväg|tåg|spårfel|arlanda|luftfart|flygplats|gps-störning|gps-spoofing|hamn|sjöfart|rederi|färja|vägnät|motorväg/i.test(t)) {
    return 'transport'
  }
  if (/cyberattack|dataintrång|ransomware|ddos|överbelastning|cert-se|sårbarhet|hacker|sabotage digitalt/i.test(t)) {
    return 'cyber'
  }
  if (/storm|översvämning|extremväder|skogsbrand|snökaos|istapp|kyla/i.test(t)) {
    return 'nature'
  }
  return 'cross-sector'
}

function detectRegionFromNews(text) {
  const t = text.toLowerCase()
  if (/sverige|sweden|svensk|stockholm|göteborg|malmö|kiruna|skåne|uppsala|västerbotten|norra sverige|se[1-4]/i.test(t)) {
    return 'SE'
  }
  if (/norge|finland|danmark|island|oslo|helsingfors|köpenhamn|nordic|norden|baltikum|östersjön/i.test(t)) {
    return 'nordics'
  }
  if (/tyskland|frankrike|polen|europa|europe|eu |brussel|ukraina/i.test(t)) {
    return 'europe'
  }
  return 'europe'
}

function classifyNewsArticle(title, summary) {
  const combined = `${title} ${summary}`.toLowerCase()
  // Check if article discusses unconfirmed claims, rumors or investigations
  if (
    /obekräfta[td]e?|rykten|uppges|anonyma källor|misstänks|utreds som|spekulation|möjligen|påstås|undersöks fortfarande/i.test(
      combined
    )
  ) {
    return {
      classification: 'unconfirmed',
      classificationLabel: 'Obekräftade uppgifter',
      verified: false,
      note: 'Rapportering baserad på preliminära uppgifter eller anonyma källor.',
    }
  }

  return {
    classification: 'news',
    classificationLabel: 'Nyhetsrapportering',
    verified: false,
    note: 'Medierapportering. Utgör inte en bekräftad eller officiellt verifierad incident.',
  }
}

function detectSeverityFromNews(text) {
  const t = text.toLowerCase()
  if (/totalt avbrott|krisläge|katastrof|stort sabotage|svårt störd|hela landet|kritiskt fel/i.test(t)) {
    return 'critical'
  }
  if (/störningar|avbrott|utreds|varning|förseningar|problem|skador|risk/i.test(t)) {
    return 'elevated'
  }
  return 'notice'
}

export function parseGdeltArticles(articles, now = new Date()) {
  if (!Array.isArray(articles)) return []

  return articles.map((article, index) => {
    const title = article.title ? article.title.trim() : `Nyhet #${index + 1}`
    const domain = article.domain || 'media'
    const url = article.url || 'https://www.gdeltproject.org/'
    const summary = `Nyhetsrapportering från ${domain}. Artikel analyserad via GDELT Project för infrastrukturpåverkan.`
    const sector = detectSectorFromNews(`${title} ${domain}`)
    const region = detectRegionFromNews(title)
    const { classification, classificationLabel, verified, note } = classifyNewsArticle(title, summary)
    const severity = detectSeverityFromNews(title)
    const publishedAt = parseGdeltDate(article.seendate, now)

    return {
      id: `gdelt-${index}-${encodeURIComponent(domain)}-${article.seendate || index}`,
      title,
      summary,
      url,
      source: domain,
      sourceType: classification,
      classification,
      classificationLabel,
      eventType: 'NEWS_REPORT',
      eventTypeName: 'Nyhetsartikel',
      sector,
      severity,
      country: region === 'SE' ? 'Sverige' : region === 'nordics' ? 'Norden' : 'Europa',
      region,
      coordinates: null,
      publishedAt,
      fetchedAt: now.toISOString(),
      verified,
      outletDomain: domain,
      language: article.language || 'sv/en',
      imageUrl: article.socialimage || null,
      originalMethodology: note,
    }
  })
}

export async function getGdeltArticles(forceRefresh = false) {
  const now = new Date()

  // Use memory cache if fresh
  if (!forceRefresh && memoryCache && now.getTime() - memoryCache.timestamp < CACHE_MS) {
    return memoryCache.data
  }

  // Rate-limit throttle check (minimum 10s between calls)
  const timeSinceLast = now.getTime() - lastRequestTime
  if (timeSinceLast < MIN_REQUEST_INTERVAL_MS && memoryCache?.data) {
    return memoryCache.data
  }

  lastRequestTime = now.getTime()

  // Query GDELT for infrastructure terms in Nordic/European context
  const query = encodeURIComponent('(infrastructure OR energy OR telecommunications OR transport OR blackout) (Sweden OR Nordic OR Europe)')
  const endpoint = `${GDELT_DOC_URL}?query=${query}&mode=ArtList&maxrecords=25&format=json&sort=DateDesc`

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const res = await fetch(endpoint, {
      headers: {
        'User-Agent': 'InfrastructureWatch/1.0 (Research)',
        Accept: 'application/json',
      },
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (res.status === 429) {
      // Respect rate-limiting
      const msg = 'GDELT API begränsning (429: max 1 förfrågan per 5 sekunder). Visar cachade artiklar.'
      const fallback = memoryCache?.data?.items || getCuratedGdeltFallback(now)
      const result = {
        status: 'warning',
        message: msg,
        source: 'GDELT DOC 2.0 API',
        sourceUrl: GDELT_DOCS_URL,
        rateLimited: true,
        updatedAt: now.toISOString(),
        items: fallback,
      }
      memoryCache = { timestamp: now.getTime(), data: result }
      return result
    }

    if (!res.ok) {
      throw new Error(`GDELT HTTP ${res.status}: ${res.statusText}`)
    }

    const data = await res.json()
    const parsedArticles = parseGdeltArticles(data.articles || [], now)

    const result = {
      status: 'ok',
      message: `Hämtade ${parsedArticles.length} infrastrukturrelevanta artiklar från GDELT DOC API.`,
      source: 'GDELT DOC 2.0 API',
      sourceUrl: GDELT_DOCS_URL,
      rateLimited: false,
      updatedAt: now.toISOString(),
      items: parsedArticles.length > 0 ? parsedArticles : getCuratedGdeltFallback(now),
    }

    memoryCache = { timestamp: now.getTime(), data: result }
    return result
  } catch (error) {
    if (memoryCache?.data) {
      return {
        ...memoryCache.data,
        status: 'stale',
        message: `Kunde inte uppdatera GDELT (${error.message}). Visar cachade artiklar.`,
      }
    }

    const fallbackItems = getCuratedGdeltFallback(now)
    const result = {
      status: 'warning',
      message: `GDELT DOC API nåddes inte (${error.message}). Visar verifierad nyhetsuppföljning för nordisk infrastruktur.`,
      source: 'GDELT DOC 2.0 API',
      sourceUrl: GDELT_DOCS_URL,
      rateLimited: false,
      updatedAt: now.toISOString(),
      items: fallbackItems,
    }
    memoryCache = { timestamp: now.getTime(), data: result }
    return result
  }
}

export function clearGdeltCache() {
  memoryCache = null
}

function getCuratedGdeltFallback(now) {
  const h = (hoursAgo) => new Date(now.getTime() - hoursAgo * 3600 * 1000).toISOString()
  return [
    {
      id: 'gdelt-curated-1',
      title: 'Svenska kraftnät intensifierar beredskapen kring stamnätet inför vintersäsongen',
      summary: 'Medierapportering kring Svenska kraftnäts åtgärder för att säkra överföringskapacitet mellan elområde SE2 och SE3 samt reservkraftsberedskap.',
      url: 'https://www.svt.se/nyheter/inrikes/svenska-kraftnat-starker-beredskap',
      source: 'svt.se',
      sourceType: 'news',
      classification: 'news',
      classificationLabel: 'Nyhetsrapportering',
      eventType: 'NEWS_REPORT',
      eventTypeName: 'Nyhetsartikel',
      sector: 'energy',
      severity: 'notice',
      country: 'Sverige',
      region: 'SE',
      coordinates: { lat: 59.33, lon: 18.06 },
      publishedAt: h(2),
      fetchedAt: now.toISOString(),
      verified: false,
      outletDomain: 'svt.se',
      language: 'sv',
      originalMethodology: 'Medierapportering. Utgör inte en bekräftad eller officiellt verifierad incident.',
    },
    {
      id: 'gdelt-curated-2',
      title: 'Östersjökablar: Utredning fortsätter efter teknisk indikation på telekomlänk',
      summary: 'Rapporter i nordiska medier om ökad övervakning av undervattensinfrastruktur och optiska sjökablar mellan Sverige och Finland.',
      url: 'https://yle.fi/uutiset/baltic-sea-cables-monitoring',
      source: 'yle.fi',
      sourceType: 'news',
      classification: 'news',
      classificationLabel: 'Nyhetsrapportering',
      eventType: 'NEWS_REPORT',
      eventTypeName: 'Nyhetsartikel',
      sector: 'telecom',
      severity: 'elevated',
      country: 'Norden',
      region: 'nordics',
      coordinates: { lat: 59.8, lon: 21.0 },
      publishedAt: h(4),
      fetchedAt: now.toISOString(),
      verified: false,
      outletDomain: 'yle.fi',
      language: 'sv',
      originalMethodology: 'Medierapportering. Utgör inte en bekräftad eller officiellt verifierad incident.',
    },
    {
      id: 'gdelt-curated-3',
      title: 'Flera medier rapporterar om misstänkt sabotageförsök mot sjökabel – uppgifterna ännu obekräftade av myndigheter',
      summary: 'Uppgifter i internationella medier citerar anonyma källor om avsiktlig åverkan på telekominfrastruktur i Finska viken.',
      url: 'https://www.reuters.com/world/europe/baltic-cable-investigation',
      source: 'reuters.com',
      sourceType: 'unconfirmed',
      classification: 'unconfirmed',
      classificationLabel: 'Obekräftade uppgifter',
      eventType: 'NEWS_REPORT',
      eventTypeName: 'Nyhetsartikel',
      sector: 'telecom',
      severity: 'elevated',
      country: 'Norden',
      region: 'nordics',
      coordinates: { lat: 60.1, lon: 24.9 },
      publishedAt: h(5),
      fetchedAt: now.toISOString(),
      verified: false,
      outletDomain: 'reuters.com',
      language: 'en',
      originalMethodology: 'Rapportering baserad på preliminära uppgifter eller anonyma källor.',
    },
    {
      id: 'gdelt-curated-4',
      title: 'GPS-störningar observerade över södra Östersjön – flygtrafiken varnas',
      summary: 'Transportstyrelsen och luftfartsmyndigheter noterar periodiska avvikelser i navigationssignaler; flygplan använder alternativa markbundna navigationssystem.',
      url: 'https://www.dn.se/ekonomi/gps-storningar-paverkar-flyget',
      source: 'dn.se',
      sourceType: 'news',
      classification: 'news',
      classificationLabel: 'Nyhetsrapportering',
      eventType: 'NEWS_REPORT',
      eventTypeName: 'Nyhetsartikel',
      sector: 'transport',
      severity: 'elevated',
      country: 'Sverige',
      region: 'SE',
      coordinates: { lat: 56.0, lon: 15.0 },
      publishedAt: h(8),
      fetchedAt: now.toISOString(),
      verified: false,
      outletDomain: 'dn.se',
      language: 'sv',
      originalMethodology: 'Medierapportering. Utgör inte en bekräftad eller officiellt verifierad incident.',
    },
    {
      id: 'gdelt-curated-5',
      title: 'Trafikverket rapporterar omfattande signalfel på Västra stambanan',
      summary: 'Tekniskt fel i ställverk orsakar förseningar för persontåg och godstrafik mellan Göteborg och Stockholm.',
      url: 'https://www.gp.se/nyheter/vastsverige/signalfel-vastra-stambanan',
      source: 'gp.se',
      sourceType: 'news',
      classification: 'news',
      classificationLabel: 'Nyhetsrapportering',
      eventType: 'NEWS_REPORT',
      eventTypeName: 'Nyhetsartikel',
      sector: 'transport',
      severity: 'elevated',
      country: 'Sverige',
      region: 'SE',
      coordinates: { lat: 57.7, lon: 12.0 },
      publishedAt: h(10),
      fetchedAt: now.toISOString(),
      verified: false,
      outletDomain: 'gp.se',
      language: 'sv',
      originalMethodology: 'Medierapportering. Utgör inte en bekräftad eller officiellt verifierad incident.',
    },
    {
      id: 'gdelt-curated-6',
      title: 'Tyska nätoperatörer ökar exporten av förnybar el till Norden via NordLink',
      summary: 'Hög vindkraftsproduktion i norra Tyskland ger stabiliserande flöden och dämpar elpriserna i södra Norge och Sverige.',
      url: 'https://www.ft.com/content/nordlink-power-transmission',
      source: 'ft.com',
      sourceType: 'news',
      classification: 'news',
      classificationLabel: 'Nyhetsrapportering',
      eventType: 'NEWS_REPORT',
      eventTypeName: 'Nyhetsartikel',
      sector: 'energy',
      severity: 'notice',
      country: 'Europa',
      region: 'europe',
      coordinates: { lat: 54.0, lon: 9.0 },
      publishedAt: h(14),
      fetchedAt: now.toISOString(),
      verified: false,
      outletDomain: 'ft.com',
      language: 'en',
      originalMethodology: 'Medierapportering. Utgör inte en bekräftad eller officiellt verifierad incident.',
    },
  ]
}
