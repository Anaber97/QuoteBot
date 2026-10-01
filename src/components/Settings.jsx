import { useSettingsDraft } from '../features/settings/useSettingsDraft';
import { useWorkspaceMembers } from '../features/settings/useWorkspaceMembers';
import { useGeofenceSettings } from '../features/settings/useGeofenceSettings';
import { createSettingsEdits } from '../features/settings/createSettingsEdits';
// src/components/Settings.jsx
import React, { useState, useMemo } from 'react';
import { Save, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';

import {
  SettingsTabsNav,
  PricingTab,
  GeofencesTab,
  BasesTab,
  ClientPortalTab,
  UsersTab,
  BrandingTab,
} from './Settings/index';


export default function Settings({ config, onSaveConfig, currentUserRole, profile }) {
  const [activeSubTab, setActiveSubTab] = useState('pricing');
  const draft = useSettingsDraft({ config, onSaveConfig, profile });
  const { formData, setFormData, saveStatus, setSaveStatus, hasUnsavedChanges, handleSave } = draft;
  const members = useWorkspaceMembers(profile);
  const {
    companyUsers,
    clientAccounts,
    inviteName,
    setInviteName,
    inviteEmail,
    setInviteEmail,
    inviteRole,
    setInviteRole,
    inviteClientId,
    setInviteClientId,
    inviteStatus,
    userEdits,
    setUserEdits,
    editingUserIds,
    handleInviteUser,
    handleEditUser,
    formatRole,
  } = members;
  const isSaving = draft.isSaving || members.isSaving;
  const {
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
  } = useGeofenceSettings({ formData, setFormData, setSaveStatus });
  const {
    updatePricing,
    updatePricingMode,
    updateCustomSurcharge,
    addCustomSurcharge,
    toggleCustomSurcharge,
    removeCustomSurcharge,
    updateClientPortal,
    updateClientPortalTier,
    addClientPortalTier,
    removeClientPortalTier,
    reorderClientPortalTier,
    addClientPortalClient,
    removeClientPortalClient,
    updateClientPortalClient,
    updateClientPortalClientPricing,
    addTruckClass,
    removeTruckClass,
    reorderTruckClass,
    addBase,
    removeBase,
  } = createSettingsEdits(setFormData, profile);


  // Filters are local to the pricing view.
  const [customSurchargeSearch, setCustomSurchargeSearch] = useState('');
  const [customSurchargeFilter, setCustomSurchargeFilter] = useState('all');

  const canEdit = currentUserRole === 'manager';
  const updateBranding = (field, value) => setFormData((prev) => ({ ...prev, branding: { ...(prev.branding || {}), [field]: value } }));

  const customSurchargeItems = useMemo(() => {
    const items = formData.pricing?.custom_surcharges || [];
    const query = customSurchargeSearch.toLowerCase();

    return items.filter((item) => {
      const matchesFilter =
        customSurchargeFilter === 'all' ||
        (customSurchargeFilter === 'active' && item.active !== false) ||
        (customSurchargeFilter === 'inactive' && item.active === false);
      const matchesSearch = !query || item.name.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [formData.pricing?.custom_surcharges, customSurchargeFilter, customSurchargeSearch]);
  if (!canEdit) {
    return (
      <div className="p-8 text-center bg-[#0c1019] border border-red-800/40 rounded-xl my-4">
        <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">Access Restricted</h3>
        <p className="text-xs text-slate-400">Settings & Configuration are restricted to authorized workspace roles.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[32rem] flex-col rounded-xl border border-slate-800 bg-[#0c1019] lg:h-[calc(100dvh-8.5rem)] lg:overflow-hidden">
      {/* Sub-navigation Tabs */}
      <SettingsTabsNav
        activeSubTab={activeSubTab}
        setActiveSubTab={setActiveSubTab}
        allGeofencesCount={allGeofences.length}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      <div className="min-h-0 flex-1 px-3 py-4 sm:px-4 lg:overflow-y-auto">

      {/* SUB TAB 1: PRICING */}
      {activeSubTab === 'pricing' && (
        <PricingTab
          formData={formData}
          updatePricing={updatePricing}
          updatePricingMode={updatePricingMode}
          addTruckClass={addTruckClass}
          removeTruckClass={removeTruckClass}
          reorderTruckClass={reorderTruckClass}
          customSurchargeItems={customSurchargeItems}
          addCustomSurcharge={addCustomSurcharge}
          toggleCustomSurcharge={toggleCustomSurcharge}
          removeCustomSurcharge={removeCustomSurcharge}
          updateCustomSurcharge={updateCustomSurcharge}
          customSurchargeSearch={customSurchargeSearch}
          setCustomSurchargeSearch={setCustomSurchargeSearch}
          customSurchargeFilter={customSurchargeFilter}
          setCustomSurchargeFilter={setCustomSurchargeFilter}
          updateClientPortalTier={updateClientPortalTier}
          addClientPortalTier={addClientPortalTier}
          removeClientPortalTier={removeClientPortalTier}
          reorderClientPortalTier={reorderClientPortalTier}
          updateClientPortal={updateClientPortal}
        />
      )}

      {/* SUB TAB 2: GEOFENCES */}
      {activeSubTab === 'branding' && <BrandingTab formData={formData} profile={profile} updateBranding={updateBranding} />}

      {activeSubTab === 'geofences' && (
        <GeofencesTab
          geofenceSearch={geofenceSearch}
          setGeofenceSearch={setGeofenceSearch}
          geofenceFilter={geofenceFilter}
          setGeofenceFilter={setGeofenceFilter}
          geofenceStateFilter={geofenceStateFilter}
          setGeofenceStateFilter={setGeofenceStateFilter}
          filteredGeofences={filteredGeofences}
          disabledSet={disabledSet}
          toggleGeofence={toggleGeofence}
          toggleFilteredGeofences={toggleFilteredGeofences}
          updateGeofenceOverride={updateGeofenceOverride}
          clearGeofenceOverride={clearGeofenceOverride}
          selectedGeofence={selectedGeofence}
          setSelectedGeofenceId={selectGeofence}
          formData={formData}
          geofenceStateOptions={geofenceStateOptions}
          addCustomGeofence={addCustomGeofence}
          saveCustomGeofence={saveCustomGeofence}
          deleteCustomGeofence={deleteCustomGeofence}
          draftCustomGeofence={draftCustomGeofence}
          updateDraftCustomGeofence={updateDraftCustomGeofence}
        />
      )}

      {/* SUB TAB 4: BASES */}
      {activeSubTab === 'bases' && (
        <BasesTab formData={formData} addBase={addBase} removeBase={removeBase} setFormData={setFormData} />
      )}

      {/* SUB TAB 5: CLIENT PORTAL */}
      {activeSubTab === 'client_portal' && (
        <ClientPortalTab
          formData={formData}
          profile={profile}
          updateClientPortal={updateClientPortal}
          updateClientPortalTier={updateClientPortalTier}
          addClientPortalClient={addClientPortalClient}
          removeClientPortalClient={removeClientPortalClient}
          updateClientPortalClient={updateClientPortalClient}
          updateClientPortalClientPricing={updateClientPortalClientPricing}
        />
      )}

      {/* SUB TAB 6: USERS */}
      {activeSubTab === 'users' && (
        <UsersTab
          inviteName={inviteName}
          setInviteName={setInviteName}
          inviteEmail={inviteEmail}
          setInviteEmail={setInviteEmail}
          inviteRole={inviteRole}
          setInviteRole={setInviteRole}
          inviteClientId={inviteClientId}
          setInviteClientId={setInviteClientId}
          clientAccounts={clientAccounts}
          handleInviteUser={handleInviteUser}
          isSaving={isSaving}
          inviteStatus={inviteStatus}
          companyUsers={companyUsers}
          profile={profile}
          userEdits={userEdits}
          editingUserIds={editingUserIds}
          handleEditUser={handleEditUser}
          setUserEdits={setUserEdits}
          formatRole={formatRole}
        />
      )}
      </div>

      {/* Action Footer */}
      {activeSubTab !== 'clients' && activeSubTab !== 'users' && (
        <div className="sticky bottom-0 z-30 flex flex-none items-center justify-between gap-4 rounded-b-xl border-t border-slate-800 bg-[#0c1019] px-3 py-3 shadow-[0_-10px_24px_rgba(0,0,0,0.2)] sm:px-4 lg:static">
          {saveStatus?.type === 'error' ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-red-400">
              <AlertCircle className="w-4 h-4" />
              {saveStatus.message}
            </p>
          ) : hasUnsavedChanges ? (
            <p className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
              <AlertCircle className="w-4 h-4" />
              Unsaved changes — click Save Settings to apply them.
            </p>
          ) : saveStatus ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              {saveStatus.message}
            </p>
          ) : <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><CheckCircle2 className="w-4 h-4" />All settings saved</p>}

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer shadow-lg disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save Settings' : 'Saved'}
          </button>
        </div>
      )}
    </div>
  );
}
