"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { AssetType, assetTypes } from "@/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, type ReactNode } from "react";

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Il nome dell'asset deve contenere almeno 2 caratteri.",
  }),
  type: z.enum(assetTypes, {
    errorMap: () => ({ message: "Seleziona un tipo di asset valido." }),
  }),
  value: z.coerce.number().positive({
    message: "Il valore iniziale deve essere un numero positivo.",
  }),
  ticker: z.string().optional(),
});

interface AddAssetDialogProps {
  children: ReactNode;
  onAssetAdd: (name: string, type: AssetType, value: number, ticker?: string) => void;
}

export function AddAssetDialog({ children, onAssetAdd }: AddAssetDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      value: 0,
      ticker: "",
    },
  });

  const assetType = form.watch("type");

  function onSubmit(values: z.infer<typeof formSchema>) {
    onAssetAdd(values.name, values.type, values.value, values.ticker);
    form.reset();
    setIsOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Aggiungi Nuovo Asset</DialogTitle>
          <DialogDescription>
            Inserisci i dettagli del tuo nuovo asset per aggiungerlo al portafoglio.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Asset</FormLabel>
                  <FormControl>
                    <Input placeholder="es. Apple Inc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo di Asset</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona un tipo di asset" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {assetTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {(assetType === 'Azione' || assetType === 'ETF') && (
              <FormField
                control={form.control}
                name="ticker"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Simbolo Ticker</FormLabel>
                    <FormControl>
                      <Input placeholder="es. AAPL" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
             <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valore Iniziale</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">€</span>
                      <Input type="number" placeholder="1000.00" className="pl-7" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Aggiungi Asset</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
