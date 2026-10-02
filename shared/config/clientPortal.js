/** Public portal presentation only. Pricing is calculated on the server. */
export function clientPortalConfig(config) {
  const portal = config.client_portal || {};
  const branding = config.branding || {};
  return {
    company_id: config.company_id,
    bases: (config.bases || []).map(({ id, name }) => ({ id, name })),
    branding: Object.fromEntries(['display_name', 'logo_path', 'accent_color', 'phone', 'email'].map((key) => [key, branding[key] || ''])),
    client_portal: {
      contact_phone: portal.contact_phone || '',
      contact_email: portal.contact_email || '',
      disclosure: portal.disclosure || '',
      collect_transport_dimensions: portal.osow_pricing?.enabled === true,
    },
  };
}
