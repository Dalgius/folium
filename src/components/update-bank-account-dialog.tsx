"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useEffect, useState, type ReactNode } from "react";

import { Asset } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
  balance: z.coerce.number().min(0, {
    message: "Il saldo non può essere negativo.",
  }),
});

interface UpdateBankAccountDialogProps {
  children: ReactNode;
  asset: Asset;
  onAssetUpdate: (id: string, updatedData: Partial<Omit<Asset, 'id' | 'type' | 'name' | 'ticker'>>) => void;
}

export function UpdateBankAccountDialog({ children, asset, onAssetUpdate }: UpdateBankAccountDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      balance: asset.currentValue,
    },
  });
  
  useEffect(() => {
    if (isOpen) {
      form.reset({
        balance: asset.currentValue,
      });
    }
  }, [isOpen, asset, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    onAssetUpdate(asset.id, {
        initialValue: values.balance,
        currentValue: values.balance,
        purchaseDate: new Date().toISOString(),
    });
    setIsOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Modifica Saldo: {asset.name}</DialogTitle>
          <DialogDescription>
            Aggiorna il saldo attuale di questo conto.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="balance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nuovo Saldo ({asset.currency})</FormLabel>
                  <FormControl>
                    <Input type="number" step="any" placeholder="es. 5000.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Aggiorna Saldo</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
