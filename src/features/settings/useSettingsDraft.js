import { useState, useEffect } from 'react';
import { normalizeConfig } from '../../lib/configSchema';
import { authenticatedFetch } from '../../lib/api';
import { buildSettingsPayload } from './buildSettingsPayload';

const cloneNormalizedConfig = (value) => JSON.parse(JSON.stringify(normalizeConfig(value)));

export function useSettingsDraft({ config, onSaveConfig, profile }) {
  const [formData, setFormDataState] = useState(() => cloneNormalizedConfig(config));
  const [editRevision, setEditRevision] = useState(0);
  const [saveStatus, setSaveStatus] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const setFormData = (update) => {
    setFormDataState(update);
    setEditRevision((revision) => revision + 1);
    setSaveStatus(null);
  };

  useEffect(() => {
    if (config) {
      setFormDataState(cloneNormalizedConfig(config));
      setEditRevision(0);
    }
  }, [config]);

  const hasUnsavedChanges = editRevision > 0;

  const handleSave = async (sourceData) => {
  const configSource =
    sourceData && typeof sourceData === 'object' && !('nativeEvent' in sourceData)
      ? sourceData
      : formData;
    const configToSave = normalizeConfig(configSource);
    const companyId = profile?.company_id || configToSave?.company_id;

    if (!companyId) {
      setSaveStatus({ type: 'error', message: 'No company ID found.' });
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    try {
      const normalizedConfig = buildSettingsPayload(configToSave, companyId);

      const response = await authenticatedFetch('/api/saveAppConfig', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          config: normalizedConfig,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || `Settings save failed (${response.status}).`);
      }

      // Adopt the persisted server response after validation and normalization.
      const savedConfig = normalizeConfig(result?.config || normalizedConfig);
      setSaveStatus({ type: 'success', message: 'Configuration saved successfully!' });
      setFormDataState(cloneNormalizedConfig(savedConfig));
      setEditRevision(0);
      if (onSaveConfig) onSaveConfig(savedConfig);
    } catch (err) {
      console.error('Error saving app_config:', err);
      setSaveStatus({ type: 'error', message: err.message || 'Failed to save settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  return { formData, setFormData, saveStatus, setSaveStatus, isSaving, hasUnsavedChanges, handleSave };
}
