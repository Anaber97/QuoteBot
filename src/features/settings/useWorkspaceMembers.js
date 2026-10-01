import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { authenticatedFetch } from '../../lib/api';

const formatRole = (role) => {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'manager') return 'Manager';
  if (normalized === 'dispatch') return 'Dispatch';
  if (normalized === 'client') return 'Client';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export function useWorkspaceMembers(profile) {
  const [isSaving, setIsSaving] = useState(false);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [clientAccounts, setClientAccounts] = useState([]);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('client');
  const [inviteClientId, setInviteClientId] = useState('');
  const [inviteStatus, setInviteStatus] = useState(null);
  const [userEdits, setUserEdits] = useState({});
  const [editingUserIds, setEditingUserIds] = useState({});
  useEffect(() => {
    if (!profile?.company_id) {
      setCompanyUsers([]);
      setClientAccounts([]);
      return;
    }

    let isMounted = true;

    const loadCompanyUsers = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, company_id, client_id, created_at')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: true });

      if (!isMounted) return;

      if (error) {
        console.error('Error loading workspace members:', error);
        setCompanyUsers([]);
        return;
      }

      setCompanyUsers((data || []).filter(Boolean));

      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, client_name')
        .eq('company_id', profile.company_id)
        .order('client_name', { ascending: true });
      if (!clientsError) setClientAccounts(clients || []);
    };

    loadCompanyUsers();

    return () => {
      isMounted = false;
    };
  }, [profile?.company_id]);

  const handleInviteUser = async () => {
  if (!profile?.company_id) {
    setInviteStatus({ type: 'error', message: 'No company available for this invite.' });
    return;
  }

  const trimmedEmail = inviteEmail.trim().toLowerCase();
  if (!trimmedEmail) {
    setInviteStatus({ type: 'error', message: 'Please enter an email address.' });
    return;
  }

  setIsSaving(true);
  setInviteStatus(null);

  try {
    // 1. Send API request to trigger Supabase Admin Invite
    const response = await authenticatedFetch("/api/inviteUser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: trimmedEmail,
        role: inviteRole,
        company_id: profile?.company_id,
        client_id: inviteRole === 'client' && inviteClientId ? inviteClientId : null,
        name: inviteName.trim(),
      }),
    });

    // Check if the endpoint returned valid JSON before parsing
    const contentType = response.headers.get("content-type");
    if (!response.ok || !contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      throw new Error(`API error (${response.status}): ${text.slice(0, 100) || 'Invalid server response'}`);
    }

    const apiResult = await response.json();
    if (apiResult.error) throw new Error(apiResult.error);

    setInviteStatus({
      type: 'success',
      message: `Invite sent to ${trimmedEmail}.`,
    });
    setInviteName('');
    setInviteEmail('');
    setInviteRole('client');
  } catch (err) {
    console.error('Error sending invite:', err);
    setInviteStatus({ type: 'error', message: err.message || 'Failed to send invite.' });
  } finally {
    setIsSaving(false);
  }
};

  const handleEditUser = async (userId) => {
    if (editingUserIds[userId]) {
      const edits = userEdits[userId] || {};
      const nextName = (edits.full_name || '').trim();
      const nextRole = (edits.role || 'client').toLowerCase();

      try {
        setIsSaving(true);
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: nextName || null,
            role: nextRole,
          })
          .eq('id', userId);

        if (error) throw error;

        setCompanyUsers((prev) =>
          prev.map((user) =>
            user.id === userId
              ? { ...user, full_name: nextName || user.full_name || user.email || '', role: nextRole }
              : user
          )
        );

        setUserEdits((prev) => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
        setEditingUserIds((prev) => ({ ...prev, [userId]: false }));
        setInviteStatus({ type: 'success', message: 'User updated successfully.' });
      } catch (err) {
        console.error('Error updating user:', err);
        setInviteStatus({ type: 'error', message: err.message || 'Failed to update user.' });
      } finally {
        setIsSaving(false);
      }
      return;
    }

    const currentUser = companyUsers.find((user) => user.id === userId) || profile;
    setUserEdits((prev) => ({
      ...prev,
      [userId]: {
        full_name: currentUser?.full_name || currentUser?.name || '',
        role: currentUser?.role || 'client',
      },
    }));
    setEditingUserIds((prev) => ({ ...prev, [userId]: true }));
  };

  return {
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
    isSaving,
  };
}
