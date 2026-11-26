import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { api, type Permission, type PermissionGroup, type Role } from '@/services/api';
import { isSuperAdministrator } from '@/utils/permissions';
import { useAuth } from '@/contexts/AuthContext';

function permissionIds(role: Role): number[] {
  return (role.permissions ?? []).map((permission) => permission.id);
}

export default function RolesPermissions() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [roleLabel, setRoleLabel] = useState('');
  const [newRole, setNewRole] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextRoles, nextGroups] = await Promise.all([api.roles.list(), api.roles.permissions()]);
      setRoles(nextRoles);
      setGroups(nextGroups);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load roles and permissions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (!isSuperAdministrator(user)) {
    return <div className="card-elegant p-6 text-sm text-slate-700">Only a Super Administrator can manage roles and permissions.</div>;
  }

  const startEdit = (role: Role) => {
    setActiveRole(role);
    setRoleLabel(role.label || role.name);
    setSelected(permissionIds(role));
    setNewRole(false);
    setError('');
    setNotice('');
  };

  const startCreate = () => {
    setActiveRole(null);
    setRoleLabel('');
    setSelected([]);
    setNewRole(true);
    setError('');
    setNotice('');
  };

  const toggle = (permission: Permission) => setSelected((current) =>
    current.includes(permission.id) ? current.filter((id) => id !== permission.id) : [...current, permission.id]
  );

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      if (newRole) {
        const name = roleLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        await api.roles.create({ name: name.startsWith('role_') ? name : `role_${name}`, label: roleLabel.trim(), permission_ids: selected });
        setNotice('Role created.');
      } else if (activeRole) {
        if (!window.confirm(`Save permission changes for ${activeRole.label || activeRole.name}? They take effect on the next request.`)) return;
        await api.roles.update(activeRole.id, { label: roleLabel.trim(), permission_ids: selected });
        setNotice('Role permissions updated.');
      }
      setActiveRole(null);
      setNewRole(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this role.');
    } finally {
      setSaving(false);
    }
  };

  const removeRole = async (role: Role) => {
    if (role.is_system || role.users_count) return;
    if (!window.confirm(`Delete the ${role.label || role.name} role? This cannot be undone.`)) return;
    try {
      await api.roles.delete(role.id);
      setNotice('Role deleted.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete this role.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Roles & permissions" subtitle="Set access by responsibility. The API checks each request against the latest permissions." />
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</div>}
      <div className="grid gap-6 xl:grid-cols-[minmax(17rem,0.75fr)_minmax(0,1.5fr)]">
        <section className="card-elegant p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><h2 className="font-semibold text-slate-900">Roles</h2><p className="mt-1 text-sm text-slate-500">System roles have protected names.</p></div>
            <button className="btn-brand px-3 py-2" onClick={startCreate}>New role</button>
          </div>
          {loading ? <div className="py-8 text-sm text-slate-500">Loading roles…</div> : (
            <ul className="divide-y divide-slate-100">
              {roles.map((role) => (
                <li key={role.id} className="flex items-center gap-2 py-3">
                  <button onClick={() => startEdit(role)} className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-left hover:bg-slate-50 ${activeRole?.id === role.id ? 'bg-amber-50 ring-1 ring-amber-200' : ''}`}>
                    <span className="block truncate text-sm font-semibold text-slate-800">{role.label || role.name}</span>
                    <span className="mt-1 block text-xs text-slate-500">{role.users_count ?? 0} users · {role.permissions?.length ?? 0} permissions{role.is_system ? ' · built-in' : ''}</span>
                  </button>
                  {!role.is_system && !role.users_count && <button onClick={() => void removeRole(role)} className="rounded-lg px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50">Delete</button>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-elegant p-5 sm:p-6">
          {!activeRole && !newRole ? (
            <div className="flex min-h-64 flex-col items-center justify-center text-center">
              <h2 className="font-semibold text-slate-900">Choose a role to review access</h2>
              <p className="mt-2 max-w-md text-sm text-slate-500">HR and Accounts start with practical defaults. The Super Administrator retains complete access.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
                <div><h2 className="font-semibold text-slate-900">{newRole ? 'Create role' : `Edit ${activeRole?.label || activeRole?.name}`}</h2><p className="mt-1 text-sm text-slate-500">Access changes are effective immediately for subsequent requests.</p></div>
                <button onClick={() => { setActiveRole(null); setNewRole(false); }} className="text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</button>
              </div>
              <label className="mt-5 block max-w-lg text-sm font-medium text-slate-700">
                Role name
                <input value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)} disabled={!newRole && activeRole?.is_system} className="form-input mt-1.5" placeholder="e.g. Event coordinator" />
                {!newRole && activeRole?.is_system && <span className="mt-1 block text-xs font-normal text-slate-500">Built-in role names are protected.</span>}
              </label>
              <div className="mt-6 space-y-5">
                {groups.map((group) => (
                  <fieldset key={group.module} className="rounded-xl border border-slate-200 p-4">
                    <legend className="px-1 text-sm font-semibold text-slate-800">{group.module}</legend>
                    <div className="mt-1 grid gap-x-5 gap-y-2 sm:grid-cols-2">
                      {group.permissions.map((permission) => (
                        <label key={permission.id} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 text-sm text-slate-700 hover:bg-slate-50">
                          <input type="checkbox" disabled={activeRole?.name === 'super_admin'} checked={selected.includes(permission.id)} onChange={() => toggle(permission)} className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
                          <span>{permission.label || permission.name}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
              {activeRole?.name === 'super_admin' && <p className="mt-4 text-sm text-slate-600">Super Administrator permissions are protected and cannot be changed.</p>}
              <div className="mt-6 flex justify-end">
                <button disabled={saving || !roleLabel.trim() || activeRole?.name === 'super_admin'} onClick={() => void save()} className="btn-brand disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving…' : newRole ? 'Create role' : 'Save changes'}</button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
