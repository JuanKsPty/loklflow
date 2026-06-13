'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LayersIcon } from 'lucide-react';
import { TABLE_SHAPES, type Sector, type TableShape } from '@loklflow/types';
import { tablesApi } from '@/lib/api/tables.api';
import { TABLE_SHAPE_LABELS } from './constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Field, FieldLabel, FieldGroup } from '@/components/ui/field';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  sectors: Sector[];
}

export function BulkTablesDialog({ sectors }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sectorId, setSectorId] = useState('');
  const [count, setCount] = useState(4);
  const [capacity, setCapacity] = useState(4);
  const [shape, setShape] = useState<TableShape>('square');

  async function handleSubmit() {
    if (!sectorId) {
      toast.error('Selecciona un sector');
      return;
    }
    if (count < 1) {
      toast.error('La cantidad debe ser al menos 1');
      return;
    }
    setSubmitting(true);
    try {
      await tablesApi.createMany({ sectorId, count, capacity, shape });
      toast.success(`${count} mesa${count > 1 ? 's' : ''} creada${count > 1 ? 's' : ''}`);
      setOpen(false);
      setSectorId('');
      setCount(4);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear las mesas');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <LayersIcon />
            Crear varias
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear varias mesas</DialogTitle>
          <DialogDescription>
            Se crearán en el sector elegido con números consecutivos automáticos.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel>Sector</FieldLabel>
            <Select
              items={sectors.map((s) => ({ value: s.id, label: s.name }))}
              value={sectorId || null}
              onValueChange={(v) => setSectorId(v ?? '')}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un sector" />
              </SelectTrigger>
              <SelectContent>
                {sectors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="flex gap-4">
            <Field className="max-w-32">
              <FieldLabel htmlFor="bulk-count">Cantidad</FieldLabel>
              <Input
                id="bulk-count"
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </Field>
            <Field className="max-w-32">
              <FieldLabel htmlFor="bulk-capacity">Capacidad</FieldLabel>
              <Input
                id="bulk-capacity"
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel>Forma</FieldLabel>
            <Select
              items={TABLE_SHAPES.map((s) => ({ value: s, label: TABLE_SHAPE_LABELS[s] }))}
              value={shape}
              onValueChange={(v) => setShape((v as TableShape) ?? 'square')}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TABLE_SHAPES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {TABLE_SHAPE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Spinner />}
            {submitting ? 'Creando…' : 'Crear mesas'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
