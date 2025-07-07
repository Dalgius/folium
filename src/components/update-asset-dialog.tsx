
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useEffect, useState, type ReactNode } from "react";
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';

import { Asset } from "@/types";
import { cn } from "@/lib/utils";
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
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";

const formSchema = z.object({
  quantity: z.coerce.number().positive({
    message: "La quantità deve essere un numero positivo.",
  }),
  purchasePrice: z.coerce.number().positive({
    message: "Il prezzo deve essere un numero positivo.",
  }),
  purchaseDate: z.date({
    required_error: "È richiesta una data di acquisto.",
  }),
});

interface UpdateAssetDialogProps {
  children: ReactNode;
  asset: Asset;
  onAssetUpdate: (id: string, updatedData: Partial<Omit<Asset, 'id' | 'type' | 'name' | 'ticker'>>) => void;
}

export function UpdateAssetDialog({ children, asset, onAssetUpdate }: UpdateAssetDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: asset.quantity,
      purchasePrice: asset.purchasePrice,
      purchaseDate: asset.purchaseDate ? parseISO(asset.purchaseDate) : new Date(),
    },
  });
  
  useEffect(() => {
    if (isOpen) {
      form.reset({
        quantity: asset.quantity,
        purchasePrice: asset.purchasePrice,
        purchaseDate: asset.purchaseDate ? parseISO(asset.purchaseDate) : new Date(),
      });
    }
  }, [isOpen, asset, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    onAssetUpdate(asset.id, {
        quantity: values.quantity,
        purchasePrice: values.purchasePrice,
        purchaseDate: values.purchaseDate.toISOString()
    });
    setIsOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Modifica Asset: {asset.name}</DialogTitle>
          <DialogDescription>
            Aggiorna i dettagli di questo asset.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
             <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantità</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="ad esempio 10" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="purchasePrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prezzo di acquisto</FormLabel>
                  <FormControl>
                    <div className="relative">
                       <Input type="number" placeholder="ad esempio 150,00" {...field} />
                       <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground">EUR</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="purchaseDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data di acquisto</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? (
                            format(field.value, "dd/MM/yyyy")
                          ) : (
                            <span>Scegli una data</span>
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                        locale={it}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Aggiorna Asset</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
