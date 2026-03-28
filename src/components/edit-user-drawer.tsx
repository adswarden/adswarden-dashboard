'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CrudResourceDrawerRoot,
  CrudResourceDrawerHeader,
  CrudResourceDrawerBody,
} from '@/components/crud-resource-drawer';
import { DrawerFooter } from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { IconEye, IconEyeOff, IconLoader2 } from '@tabler/icons-react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  banned?: boolean;
}

interface EditUserDrawerProps {
  user: UserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditUserDrawer({ user, open, onOpenChange }: EditUserDrawerProps) {
  const router = useRouter();
  const [name, setName] = useState(user?.name ?? '');
  const [role, setRole] = useState<'user' | 'admin'>(user?.role === 'admin' ? 'admin' : 'user');
  const [banned, setBanned] = useState(user?.banned ?? false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setRole(user.role === 'admin' ? 'admin' : 'user');
      setBanned(user.banned ?? false);
      setNewPassword('');
      setShowNewPassword(false);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true);
    try {
      const result = await authClient.admin.updateUser({
        userId: user.id,
        data: { name: name || undefined, role, banned },
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
      toast.success('User updated');
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (!user || !newPassword.trim()) return;
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setIsChangingPassword(true);
    try {
      const result = await authClient.admin.setUserPassword({
        userId: user.id,
        newPassword: newPassword.trim(),
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
      toast.success('Password updated');
      setNewPassword('');
      setShowNewPassword(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (!user) return null;

  return (
    <CrudResourceDrawerRoot open={open} onOpenChange={onOpenChange} direction="right">
      <CrudResourceDrawerHeader title="Edit user" description={`Update ${user.email}`} />
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <CrudResourceDrawerBody>
          <div className="flex flex-col gap-6">
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={user.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="User name"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as 'user' | 'admin')}
                disabled={isLoading}
              >
                <SelectTrigger id="edit-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
              <div className="min-w-0 space-y-0.5">
                <Label htmlFor="edit-banned">Banned</Label>
                <p className="text-sm text-muted-foreground">Prevent this user from signing in</p>
              </div>
              <Switch
                id="edit-banned"
                checked={banned}
                onCheckedChange={setBanned}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-3 rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="edit-password">Change password</Label>
                <p className="text-sm text-muted-foreground">Set a new password for this user</p>
              </div>
              <div className="relative min-w-0">
                <Input
                  id="edit-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleChangePassword(e);
                    }
                  }}
                  placeholder="New password (min 8 characters)"
                  disabled={isChangingPassword}
                  minLength={8}
                  className="pr-10"
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-9 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNewPassword((v) => !v)}
                  disabled={isChangingPassword}
                  aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                  aria-pressed={showNewPassword}
                >
                  {showNewPassword ? <IconEyeOff /> : <IconEye />}
                </Button>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={(e) => handleChangePassword(e)}
                disabled={!newPassword.trim() || newPassword.length < 8 || isChangingPassword}
              >
                {isChangingPassword && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update password
              </Button>
            </div>
          </div>
        </CrudResourceDrawerBody>
        <DrawerFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DrawerFooter>
      </form>
    </CrudResourceDrawerRoot>
  );
}
