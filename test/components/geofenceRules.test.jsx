import { expect, test, vi } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import GeofencesTab from '../../src/components/Settings/GeofencesTab.jsx';
import { useGeofenceSettings } from '../../src/features/settings/useGeofenceSettings.js';
import { GEOFENCES } from '../../src/config/geofences.js';

const useSettings = (initial) => {
  const [formData, setFormData] = useState(initial);
  return { formData, ...useGeofenceSettings({ formData, setFormData, setSaveStatus: vi.fn() }) };
};

test('built-in zones start inactive and switch on through enabledZones; custom zones switch off', () => {
  const { result } = renderHook(() => useSettings({ geofences: { builtInZoneMode: 'opt_in', enabledZones: [], disabledZones: [],
    customZones: [{ id: 'custom-1', name: 'Town', shape: [] }] } }));
  expect(result.current.disabledSet.has('dfw')).toBe(true);
  expect(result.current.disabledSet.has('custom-1')).toBe(false);
  act(() => result.current.toggleGeofence('dfw'));
  act(() => result.current.toggleGeofence('custom-1'));
  expect(result.current.formData.geofences.enabledZones).toEqual(['dfw']);
  expect(result.current.formData.geofences.disabledZones).toEqual(['custom-1']);
  act(() => result.current.toggleGeofence('dfw'));
  expect(result.current.formData.geofences.enabledZones).toEqual([]);
});

test('a metro zone offers the custom-zone price rules, including a minimum', async () => {
  const updateGeofenceOverride = vi.fn();
  const zone = { ...GEOFENCES.dfw, type: 'metro' };
  const props = { filteredGeofences: [zone], disabledSet: new Set(), selectedGeofence: zone, geofenceStateOptions: [],
    formData: { geofences: { customZoneRates: { dfw: { pricingMode: 'min_rate', value: 900 } } } },
    updateGeofenceOverride, setGeofenceSearch: vi.fn(), setGeofenceFilter: vi.fn(), setGeofenceStateFilter: vi.fn(),
    toggleGeofence: vi.fn(), toggleFilteredGeofences: vi.fn(), clearGeofenceOverride: vi.fn(), setSelectedGeofenceId: vi.fn(),
    addCustomGeofence: vi.fn(), saveCustomGeofence: vi.fn(), deleteCustomGeofence: vi.fn(), updateDraftCustomGeofence: vi.fn() };
  render(<GeofencesTab {...props} />);
  const picker = screen.getByLabelText('Price rule for this zone');
  expect(picker).toHaveValue('min_rate');
  expect([...picker.options].map((option) => option.textContent)).toEqual(['Surcharge (%)', 'Surcharge ($)', 'Minimum ($)', 'Maximum ($)', 'Flat rate ($)']);
  expect(screen.getByText('min $900')).toBeInTheDocument();
  expect(screen.getByText(/raised to at least this amount/)).toBeInTheDocument();
  await userEvent.setup().selectOptions(picker, 'max_rate');
  expect(updateGeofenceOverride).toHaveBeenCalledWith('dfw', 'rule', 'max_rate');
});

test('choosing a rule sets its pricing mode and fee type together', () => {
  const { result } = renderHook(() => useSettings({ geofences: { customZoneRates: { dfw: { feeType: 'percent', value: 20 } } } }));
  act(() => result.current.updateGeofenceOverride('dfw', 'rule', 'min_rate'));
  expect(result.current.formData.geofences.customZoneRates.dfw).toEqual({ pricingMode: 'min_rate', feeType: 'flat', value: 20 });
  act(() => result.current.updateGeofenceOverride('dfw', 'rule', 'percent'));
  expect(result.current.formData.geofences.customZoneRates.dfw).toEqual({ pricingMode: 'surcharge', feeType: 'percent', value: 20 });
});
