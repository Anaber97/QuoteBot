import React from 'react';

export default function UsersTab({
  inviteName,
  setInviteName,
  inviteEmail,
  setInviteEmail,
  inviteRole,
  setInviteRole,
  inviteClientId,
  setInviteClientId,
  clientAccounts,
  handleInviteUser,
  isSaving,
  inviteStatus,
  companyUsers,
  profile,
  userEdits,
  editingUserIds,
  handleEditUser,
  setUserEdits,
  formatRole,
}) {
  return (
    <div className="space-y-4 text-xs">
      <div className="rounded-xl border border-slate-800 bg-[#080c14] p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-slate-200">Invite User</h4>
          <span className="text-[10px] text-slate-500">Invite-based access</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_0.7fr_auto]">
          <input
            type="text"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            placeholder="Name"
            className="w-full rounded-lg border border-slate-700 bg-[#121824] px-2.5 py-2 text-white"
          />
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="name@company.com"
            className="w-full rounded-lg border border-slate-700 bg-[#121824] px-2.5 py-2 text-white"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-[#121824] px-2.5 py-2 text-white"
          >
            <option value="client">Client</option>
            <option value="dispatch">Dispatch</option>
            <option value="manager">Manager</option>
          </select>
          {inviteRole === 'client' && (
            <select
              value={inviteClientId}
              onChange={(e) => setInviteClientId(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#121824] px-2.5 py-2 text-white"
            >
              <option value="">No sub-account</option>
              {clientAccounts.map((client) => <option key={client.id} value={client.id}>{client.client_name}</option>)}
            </select>
          )}
          <button
            type="button"
            onClick={handleInviteUser}
            disabled={isSaving}
            className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {isSaving ? 'Sending...' : 'Send Invite'}
          </button>
        </div>
        {inviteStatus && (
          <p className={`text-[11px] ${inviteStatus.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
            {inviteStatus.message}
          </p>
        )}
      </div>

      <div className="flex justify-between items-center">
        <h4 className="font-bold text-slate-200">Workspace Members</h4>
      </div>

      {companyUsers.length === 0 && !profile?.email && (
        <div className="rounded-lg border border-dashed border-slate-800 bg-[#080c14] p-3 text-[11px] text-slate-500">
          No workspace members found yet.
        </div>
      )}

      {(companyUsers.length > 0 ? companyUsers : profile ? [profile] : []).map((user) => {
        const draft = userEdits[user.id] || {};
        const currentName = draft.full_name ?? user.full_name ?? user.name ?? '';
        const currentRole = draft.role ?? user.role ?? 'client';
        const isEditing = Boolean(editingUserIds[user.id]);

        return (
          <div key={user.id} className="flex flex-col gap-2 bg-[#080c14] p-3 rounded-xl border border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold text-white">
                    {isEditing ? currentName || 'Workspace Member' : user.full_name || user.name || user.email || 'Workspace Member'}
                  </div>
                  <div className="text-[11px] text-slate-400">{user.email || 'No email on file'}</div>
                  {user.role === 'client' && user.client_id && (
                    <div className="text-[10px] text-violet-300">{clientAccounts.find((client) => client.id === user.client_id)?.client_name || 'Assigned client account'}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue-300">
                  {formatRole(isEditing ? currentRole : user.role || currentRole)}
                </span>
                {user.id === profile?.id && (
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                    You
                  </span>
                )}
                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => handleEditUser(user.id)}
                    disabled={isSaving}
                    className="rounded-lg border border-slate-700 bg-[#121824] px-3 py-2 text-[11px] font-semibold text-slate-200 transition hover:border-blue-500/40 hover:text-white disabled:opacity-60"
                  >
                    Edit User
                  </button>
                )}
              </div>
            </div>

            {isEditing ? (
              <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                <input
                  type="text"
                  value={currentName}
                  onChange={(e) =>
                    setUserEdits((prev) => ({
                      ...prev,
                      [user.id]: { ...prev[user.id], full_name: e.target.value },
                    }))
                  }
                  placeholder="Name"
                  className="w-full rounded-lg border border-slate-700 bg-[#121824] px-2.5 py-2 text-white"
                />
                <select
                  value={currentRole}
                  onChange={(e) =>
                    setUserEdits((prev) => ({
                      ...prev,
                      [user.id]: { ...prev[user.id], role: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-700 bg-[#121824] px-2.5 py-2 text-white"
                >
                  <option value="client">Client</option>
                  <option value="dispatch">Dispatch</option>
                  <option value="manager">Manager</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleEditUser(user.id)}
                  disabled={isSaving}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-600/20 px-3 py-2 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-600/30 disabled:opacity-60"
                >
                  Save
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
