'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { IconLoader2, IconUserPlus } from '@tabler/icons-react';
import { toast } from 'sonner';

export function AddEndUserDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [plan, setPlan] = useState<'trial' | 'paid'>('trial');
  const [banned, setBanned] = useState(false);

  const reset = () => {
    setEmail('');
    setPassword('');
    setIdentifier('');
    setName('');
    setPlan('trial');
    setBanned(false);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    const idRaw = identifier.trim();
    const hasEmail = em.length > 0;
    const hasIdentifier = idRaw.length > 0;

    if (!hasEmail && !hasIdentifier) {
      toast.error('Provide email (with password) or an identifier for an anonymous user.');
      return;
    }
    if (hasEmail && password.length < 8) {
      toast.error('Password must be at least 8 characters when email is set.');
      return;
    }
    if (hasIdentifier && idRaw.length < 8) {
      toast.error('Identifier must be at least 8 characters (alphanumeric, _ or -).');
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim() || null,
        plan,
        banned,
      };
      if (hasEmail) {
        body.email = em;
        body.password = password;
        if (hasIdentifier) body.identifier = idRaw;
      } else {
        body.identifier = idRaw;
      }

      const res = await fetch('/api/end-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as { error?: string; user?: { id: string } };
      if (!res.ok) {
        toast.error(j.error ?? 'Could not create user');
        return;
      }
      toast.success('User created');
      setOpen(false);
      reset();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" className="gap-2">
          <IconUserPlus className="h-4 w-4" aria-hidden />
          Add user
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add extension user</DialogTitle>
          <DialogDescription>
            Create a registered user (email + password) or an anonymous trial user (identifier from the
            extension).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="add-email">Email (optional if anonymous)</Label>
            <Input
              id="add-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              placeholder="you@example.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-password">Password (required with email)</Label>
            <Input
              id="add-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              disabled={submitting}
              placeholder="8+ characters when email is set"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-identifier">Identifier (anonymous user)</Label>
            <Input
              id="add-identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={submitting}
              placeholder="From extension storage, 8+ chars, a-z A-Z 0-9 _ -"
              className="font-mono text-sm"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-name">Name (optional)</Label>
            <Input
              id="add-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Plan</Label>
              <Select
                value={plan}
                onValueChange={(v) => setPlan(v as 'trial' | 'paid')}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col justify-center gap-2 rounded-lg border border-border/80 p-3">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="add-banned" className="cursor-pointer">
                  Banned
                </Label>
                <Switch
                  id="add-banned"
                  checked={banned}
                  onCheckedChange={setBanned}
                  disabled={submitting}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Creating…
                </>
              ) : (
                'Create'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
