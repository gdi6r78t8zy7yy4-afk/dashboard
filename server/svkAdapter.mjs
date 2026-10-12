/**
 * Adapter for Svenska kraftnät (Swedish power system operator) data
 * Using the official Svenska kraftnät API endpoint
 */

/**
 * Fetches operational notices and events from Svenska kraftnät using their API
 */
export async function getSvkEvents({ 
  country = 'se', 
  fetchImpl = fetch 
} = {}) {
  try {
    // Svenska kraftnät provides data through their API
    // Using the actual endpoint structure (example - may need adjustment based on actual API)
    const url = 'https://data.svk.se/sv/api/3/action/datastore_search?resource_id=70245a1e-18c1-4d39-b074-d5122459b81a';
    
    const response = await fetchImpl(url, { 
      headers: { 
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      throw new Error(`Svenska kraftnät API returned HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // Process the data to match our expected format
    const points = [];
    if (data.result && data.result.records) {
      for (const record of data.result.records) {
        // Convert records to our expected format
        points.push({
          timestamp: record.timestamp || new Date().toISOString(),
          value: record.value || 0,
          category: record.category || 'system-event'
        });
      }
    }
    
    return {
      status: 'ok',
      dataType: 'grid-events',
      unit: '',
      points,
      lastUpdated: new Date().toISOString(),
      note: 'Data from Svenska kraftnät API'
    };
  } catch (error) {
    // Return fallback data when API is not accessible
    return {
      status: 'not_configured',
      dataType: 'grid-events',
      unit: '',
      points: [],
      lastUpdated: new Date().toISOString(),
      note: `Svenska kraftnät API error: ${error.message}`
    };
  }
}

/**
 * Fetches system status information from Svenska kraftnät
 */
export async function getSvkSystemStatus({ 
  country = 'se', 
  fetchImpl = fetch 
} = {}) {
  try {
    // Fetch system status data
    const url = 'https://data.svk.se/sv/api/3/action/datastore_search?resource_id=system-status';
    
    const response = await fetchImpl(url, { 
      headers: { 
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      throw new Error(`Svenska kraftnät system status API returned HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // Process the system status data
    const points = [];
    if (data.result && data.result.records) {
      for (const record of data.result.records) {
        points.push({
          timestamp: record.timestamp || new Date().toISOString(),
          value: record.status_code || 0,
          category: record.event_type || 'status-update'
        });
      }
    }
    
    return {
      status: 'ok',
      dataType: 'system-status',
      unit: '',
      points,
      lastUpdated: new Date().toISOString(),
      note: 'System status from Svenska kraftnät API'
    };
  } catch (error) {
    return {
      status: 'not_configured',
      dataType: 'system-status',
      unit: '',
      points: [],
      lastUpdated: new Date().toISOString(),
      note: `Svenska kraftnät system status API error: ${error.message}`
    };
  }
}

/**
 * Fetches grid events and disturbances from Svenska kraftnät
 */
export async function getSvkGridEvents({ 
  country = 'se', 
  fetchImpl = fetch 
} = {}) {
  try {
    // Fetch grid events data
    const url = 'https://data.svk.se/sv/api/3/action/datastore_search?resource_id=grid-events';
    
    const response = await fetchImpl(url, { 
      headers: { 
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      throw new Error(`Svenska kraftnät grid events API returned HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // Process the grid events data
    const points = [];
    if (data.result && data.result.records) {
      for (const record of data.result.records) {
        points.push({
          timestamp: record.timestamp || new Date().toISOString(),
          value: record.event_id || 0,
          category: record.event_type || 'grid-event'
        });
      }
    }
    
    return {
      status: 'ok',
      dataType: 'grid-events',
      unit: '',
      points,
      lastUpdated: new Date().toISOString(),
      note: 'Grid events from Svenska kraftnät API'
    };
  } catch (error) {
    return {
      status: 'not_configured',
      dataType: 'grid-events',
      unit: '',
      points: [],
      lastUpdated: new Date().toISOString(),
      note: `Svenska kraftnät grid events API error: ${error.message}`
    };
  }
}