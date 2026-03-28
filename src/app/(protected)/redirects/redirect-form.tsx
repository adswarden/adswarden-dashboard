'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { IconLoader2 } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { Redirect } from '@/db/schema';

interface RedirectFormProps {
  redirect?: Redirect;
  mode: 'create' | 'edit';
  onSuccess?: (saved?: Redirect) => void | Promise<void>;
  onCancel?: () => void;
}

export function RedirectForm({ redirect: redirectRow, mode, onSuccess, onCancel }: RedirectFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState(redirectRow?.name || '');
  const [sourceDomain, setSourceDomain] = useState(redirectRow?.sourceDomain || '');
  const [includeSubdomains, setIncludeSubdomains] = useState(redirectRow?.includeSubdomains ?? false);
  const [destinationUrl, setDestinationUrl] = useState(redirectRow?.destinationUrl || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const url = mode === 'create' ? '/api/redirects' : `/api/redirects/${redirectRow?.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          sourceDomain,
          includeSubdomains,
          destinationUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save redirect');
      }

      toast.success(mode === 'create' ? 'Redirect created successfully' : 'Redirect updated successfully');
      if (onSuccess) {
        await onSuccess(data as Redirect);
      } else {
        router.push('/redirects');
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save redirect');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="redirect-name">Name *</Label>
        <Input
          id="redirect-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Marketing site redirect"
          required
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="source-domain">Source domain *</Label>
        <Input
          id="source-domain"
          value={sourceDomain}
          onChange={(e) => setSourceDomain(e.target.value)}
          placeholder="example.com"
          required
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground">
          Hostname to match (no protocol). Enable &quot;Include subdomains&quot; to match *.example.com.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-input/80 bg-muted/20 px-4 py-3">
        <div className="space-y-0.5">
          <Label htmlFor="include-subdomains" className="text-sm font-medium">
            Include subdomains
          </Label>
          <p className="text-xs text-muted-foreground">Match app.example.com, www.example.com, etc.</p>
        </div>
        <Switch
          id="include-subdomains"
          checked={includeSubdomains}
          onCheckedChange={setIncludeSubdomains}
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="destination-url">Destination URL *</Label>
        <Input
          id="destination-url"
          type="url"
          value={destinationUrl}
          onChange={(e) => setDestinationUrl(e.target.value)}
          placeholder="https://destination.example.com/path"
          required
          disabled={isLoading}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : mode === 'create' ? (
            'Create Redirect'
          ) : (
            'Update Redirect'
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => (onCancel ? onCancel() : router.push('/redirects'))}
          disabled={isLoading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
