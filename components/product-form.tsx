'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, X, ImagePlus, CircleAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { ProductImage } from '@/components/product-image';
import { CONDITIONS } from '@/lib/constants';
import type { Category, ProductCondition, Product } from '@/lib/types';

interface ProductFormProps {
  mode: 'create' | 'edit';
  categories: Category[];
  product?: Product;
  onSaved?: () => void;
}

interface FormState {
  title: string;
  description: string;
  price: string;
  category_id: string;
  condition: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function sanitizeFilename(name: string): string {
  const ext = name.split('.').pop() || 'jpg';
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

export function ProductForm({ mode, categories, product, onSaved }: ProductFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>({
    title: product?.title ?? '',
    description: product?.description ?? '',
    price: product?.price?.toString() ?? '',
    category_id: product?.category_id?.toString() ?? '',
    condition: product?.condition ?? '',
  });
  const [imageUrl, setImageUrl] = useState<string | null>(product?.image_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Please upload a JPEG, PNG, WebP, or GIF image.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('Image must be 5MB or smaller.');
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be signed in to upload images.');
        return;
      }

      const filename = sanitizeFilename(file.name);
      const path = `${user.id}/${filename}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(path, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      setImageUrl(path);
    } catch (err) {
      console.error('Image upload failed', err);
      setError('Could not upload the image. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  function removeImage() {
    setImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function validate(): string | null {
    if (!form.title.trim()) return 'Please enter a title.';
    if (form.title.length > 200) return 'Title must be 200 characters or less.';
    if (!form.description.trim()) return 'Please enter a description.';
    if (form.description.length > 5000) return 'Description must be 5000 characters or less.';
    const priceNum = parseFloat(form.price);
    if (isNaN(priceNum) || priceNum < 0) return 'Please enter a valid price.';
    if (!form.category_id) return 'Please select a category.';
    if (!form.condition) return 'Please select a condition.';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be signed in to save a listing.');
        setSaving(false);
        return;
      }

      const payload = {
        category_id: parseInt(form.category_id, 10),
        title: form.title.trim(),
        description: form.description.trim(),
        price: parseFloat(form.price),
        condition: form.condition as ProductCondition,
        image_url: imageUrl,
      };

      if (mode === 'create') {
        const { data, error: insertError } = await supabase
          .from('products')
          .insert(payload)
          .select('id')
          .single();

        if (insertError) throw insertError;
        if (imageUrl) {
          const { error: imageError } = await supabase.from('product_images').insert({
            product_id: data.id,
            image_url: imageUrl,
            sort_order: 0,
          });
          if (imageError) throw imageError;
        }
        if (onSaved) onSaved();
        else router.push(`/product/${data.id}`);
      } else if (mode === 'edit' && product) {
        const { error: updateError } = await supabase
          .from('products')
          .update(payload)
          .eq('id', product.id);

        if (updateError) throw updateError;
        if (imageUrl && imageUrl !== product.image_url) {
          const { error: imageError } = await supabase.from('product_images').insert({
            product_id: product.id,
            image_url: imageUrl,
            sort_order: 0,
          });
          if (imageError) throw imageError;
        }
        if (onSaved) onSaved();
        else router.push(`/product/${product.id}`);
        router.refresh();
      }
    } catch (err) {
      console.error('Failed to save listing', err);
      setError('Could not save the listing. Please try again.');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <CircleAlert className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          type="text"
          placeholder="e.g. Data Structures textbook, Atlas Cycle, Casio Calculator"
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          maxLength={200}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Describe the item — condition, usage, any defects, included accessories, etc."
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          maxLength={5000}
          rows={5}
          required
        />
        <p className="text-xs text-muted-foreground">{form.description.length}/5000</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="price">Price (₹)</Label>
          <Input
            id="price"
            type="number"
            min="0"
            step="1"
            placeholder="500"
            value={form.price}
            onChange={(e) => update('price', e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="condition">Condition</Label>
          <Select
            id="condition"
            value={form.condition}
            onChange={(e) => update('condition', e.target.value)}
            required
          >
            <option value="">Select condition</option>
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category_id">Category</Label>
        <Select
          id="category_id"
          value={form.category_id}
          onChange={(e) => update('category_id', e.target.value)}
          required
        >
          <option value="">Select a category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Product Image</Label>
        <p className="text-xs text-muted-foreground">JPEG, PNG, WebP, or GIF. Max 5MB.</p>
        {imageUrl ? (
          <div className="relative inline-block">
            <ProductImage
              path={imageUrl}
              alt="Product preview"
              className="h-48 w-48 rounded-lg border border-border"
            />
            <button
              type="button"
              onClick={removeImage}
              className="absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow-sm hover:bg-destructive/90"
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Spinner size="sm" />
                <span className="text-sm">Uploading...</span>
              </>
            ) : (
              <>
                <ImagePlus className="h-7 w-7" />
                <span className="text-sm">Click to upload an image</span>
                <Upload className="h-3 w-3" />
              </>
            )}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving || uploading}>
          {saving ? <Spinner size="sm" /> : mode === 'create' ? 'Create Listing' : 'Save Changes'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
