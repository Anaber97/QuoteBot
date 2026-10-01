import { useState, useMemo } from 'react';
import { GEOFENCES, HAZARD_ZONES, METRO_CODE_BY_ZONE_ID } from '../../config/geofences';
import { US_STATE_NAMES } from '../../config/usStates';

export function useGeofenceSettings({ formData, setFormData, setSaveStatus }) {
  const [geofenceSearch, setGeofenceSearch] = useState('');
  const [geofenceFilter, setGeofenceFilter] = useState('all');
  const [geofenceStateFilter, setGeofenceStateFilter] = useState('all');
  const [selectedGeofenceId, setSelectedGeofenceId] = useState(null);
  const [draftCustomGeofence, setDraftCustomGeofence] = useState(null);
  const toggleGeofence = (id) => {
    const currentDisabled = formData.geofences?.disabledZones || [];
    const updatedDisabled = currentDisabled.includes(id)
      ? currentDisabled.filter(zId => zId !== id)
      : [...currentDisabled, id];

    setFormData(prev => ({
      ...prev,
      geofences: { ...prev.geofences, disabledZones: updatedDisabled }
    }));
  };

  const toggleFilteredGeofences = () => {
    const matchedIds = filteredGeofences.map((zone) => zone.id);
    if (!matchedIds.length) return;

    const currentDisabled = formData.geofences?.disabledZones || [];
    const hasAnyEnabled = matchedIds.some((id) => !currentDisabled.includes(id));
    const updatedDisabled = hasAnyEnabled
      ? [...new Set([...currentDisabled, ...matchedIds])]
      : currentDisabled.filter((id) => !matchedIds.includes(id));

    setFormData(prev => ({
      ...prev,
      geofences: { ...prev.geofences, disabledZones: updatedDisabled },
    }));
  };

  const updateGeofenceOverride = (zoneId, fieldOrValue, maybeValue) => {
    const hasField = maybeValue !== undefined;
    const field = hasField ? fieldOrValue : 'value';
    const rawValue = hasField ? maybeValue : fieldOrValue;
    const nextValue = field === 'value' ? Number(rawValue) || 0 : rawValue;
    setFormData((prev) => ({
      ...prev,
      geofences: {
        ...prev.geofences,
        customZoneRates: {
          ...(prev.geofences?.customZoneRates || {}),
          [zoneId]: {
            ...(prev.geofences?.customZoneRates?.[zoneId] || {}),
            [field]: nextValue,
          },
        },
      },
    }));
  };

  const clearGeofenceOverride = (zoneId) => {
    setFormData((prev) => {
      const nextCustomZoneRates = { ...(prev.geofences?.customZoneRates || {}) };
      delete nextCustomZoneRates[zoneId];

      return {
        ...prev,
        geofences: {
          ...prev.geofences,
          customZoneRates: nextCustomZoneRates,
        },
      };
    });
  };

  const addCustomGeofence = () => {
    const zone = {
      id: `custom-${Date.now()}`,
      name: 'New Municipality Zone',
      localityQuery: '',
      city: '',
      state: '',
      feeType: 'percent',
      price: 25,
      priority: 0,
      shape: [],
      type: 'custom',
    };
    setDraftCustomGeofence(zone);
    setSelectedGeofenceId(zone.id);
  };

  const updateDraftCustomGeofence = (field, value) => {
    setDraftCustomGeofence((prev) => (prev ? { ...prev, [field]: value } : prev));
    const savedZones = formData.geofences?.customZones || [];
    if (draftCustomGeofence?.id && savedZones.some((zone) => zone.id === draftCustomGeofence.id)) {
      setFormData((prev) => ({
        ...prev,
        geofences: {
          ...prev.geofences,
          customZones: (prev.geofences?.customZones || []).map((zone) => (
            zone.id === draftCustomGeofence.id ? { ...zone, [field]: value } : zone
          )),
        },
      }));
    }
  };

  const saveCustomGeofence = () => {
    if (!draftCustomGeofence) return;

    const localizedCity = (draftCustomGeofence.city || '').trim();
    const localizedState = (draftCustomGeofence.state || '').trim().toUpperCase();
    const localityQuery = (draftCustomGeofence.localityQuery || [localizedCity, localizedState].filter(Boolean).join(', ')).trim();

    const cleanedZone = {
      ...draftCustomGeofence,
      name: (draftCustomGeofence.name || '').trim() || 'Custom Geofence',
      localityQuery,
      city: localizedCity,
      state: localizedState,
      feeType: draftCustomGeofence.feeType === 'flat' ? 'flat' : 'percent',
      price: Number(draftCustomGeofence.price ?? 0) || 0,
      priority: Math.max(0, Math.min(999, Number(draftCustomGeofence.priority ?? 0) || 0)),
      shape: Array.isArray(draftCustomGeofence.shape) ? draftCustomGeofence.shape : [],
    };

    if (!cleanedZone.name || (!cleanedZone.city && !cleanedZone.state && !cleanedZone.localityQuery)) {
      setSaveStatus({ type: 'error', message: 'A custom geofence needs a label and a locality selection.' });
      return;
    }

    const nextFormData = {
      ...formData,
      geofences: {
        ...formData.geofences,
        customZones: [...(formData.geofences?.customZones || []).filter((zone) => zone.id !== cleanedZone.id), cleanedZone],
      },
    };

    setFormData(nextFormData);

    setDraftCustomGeofence(null);
    setSelectedGeofenceId(cleanedZone.id);
    setSaveStatus(null);
  };

  const deleteCustomGeofence = (zoneId) => {
    setFormData((prev) => ({
      ...prev,
      geofences: {
        ...prev.geofences,
        customZones: (prev.geofences?.customZones || []).filter((zone) => zone.id !== zoneId),
      },
    }));
    if (draftCustomGeofence?.id === zoneId) {
      setDraftCustomGeofence(null);
    }
    if (selectedGeofenceId === zoneId) {
      setSelectedGeofenceId(null);
    }
  };

  const getZoneState = (cities = []) => {
    const stateCandidate = (cities || [])
      .map((city) => String(city || '').split(',').pop()?.trim().toLowerCase())
      .find((part) => part && part.length <= 3 && /^[a-z]{2}$/.test(part));
    return stateCandidate || null;
  };

  const getStateName = (state) => {
    if (!state) return '';
    return US_STATE_NAMES[String(state).trim().toLowerCase()] || String(state).toUpperCase();
  };

  const allGeofences = useMemo(() => {
    const hazardList = Object.values(HAZARD_ZONES).map((zone) => ({ ...zone, type: 'hazard', state: getZoneState(zone.cities) }));
    const metroList = Object.values(GEOFENCES).map((zone) => ({ ...zone, type: 'metro', state: getZoneState(zone.cities) }));
    const customList = (formData.geofences?.customZones || []).map((zone) => ({
      ...zone,
      type: 'custom',
      state: (zone.state || '').trim().toLowerCase() || null,
    }));
    return [...hazardList, ...metroList, ...customList];
  }, [formData.geofences?.customZones]);

  const filteredGeofences = useMemo(() => {
    return allGeofences.filter((zone) => {
      const matchesType =
        geofenceFilter === 'all' ||
        (geofenceFilter === 'hazard' && zone.type === 'hazard') ||
        (geofenceFilter === 'metro' && zone.type === 'metro') ||
        (geofenceFilter === 'custom' && zone.type === 'custom');

      const matchesState = geofenceStateFilter === 'all' || zone.state === geofenceStateFilter;

      const query = geofenceSearch.toLowerCase();
      const matchesSearch =
        !query ||
        zone.name.toLowerCase().includes(query) ||
        String(METRO_CODE_BY_ZONE_ID[String(zone.id)] || '').toLowerCase().includes(query) ||
        String(zone.state || '').toLowerCase().includes(query) ||
        getStateName(zone.state).toLowerCase().includes(query) ||
        (zone.cities || []).some((city) => city.toLowerCase().includes(query));

      return matchesType && matchesState && matchesSearch;
    });
  }, [allGeofences, geofenceFilter, geofenceStateFilter, geofenceSearch]);

  const disabledSet = new Set(formData.geofences?.disabledZones || []);
  const selectedGeofence = allGeofences.find((zone) => zone.id === selectedGeofenceId) || null;
  const selectGeofence = (zoneId) => {
    setSelectedGeofenceId(zoneId);
    const customZone = (formData.geofences?.customZones || []).find((zone) => zone.id === zoneId);
    setDraftCustomGeofence(customZone ? { ...customZone } : null);
  };
  const geofenceStateOptions = useMemo(
    () => Array.from(new Set(allGeofences.map((zone) => zone.state))).filter(Boolean).sort(),
    [allGeofences]
  );

  return {
    geofenceSearch,
    setGeofenceSearch,
    geofenceFilter,
    setGeofenceFilter,
    geofenceStateFilter,
    setGeofenceStateFilter,
    draftCustomGeofence,
    allGeofences,
    filteredGeofences,
    disabledSet,
    selectedGeofence,
    selectGeofence,
    geofenceStateOptions,
    toggleGeofence,
    toggleFilteredGeofences,
    updateGeofenceOverride,
    clearGeofenceOverride,
    addCustomGeofence,
    updateDraftCustomGeofence,
    saveCustomGeofence,
    deleteCustomGeofence,
  };
}
