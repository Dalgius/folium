
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useState, type ReactNode, useEffect, useMemo, useRef } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Calendar as CalendarIcon, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AssetType } from "@/types";
import { getQuote, searchSecurities, type SearchResult } from "@/services/finance.service";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverAnchor,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const mapQuoteTypeToAssetType = (quoteType: string): AssetType => {
  switch(quoteType) {
    case 'EQUITY': return 'Azione';
    case 'ETF': return 'ETF';
    default: return 'Azione';
  }
}

export const addAssetFormSchema = z.object({
  ticker: z.string().min(1, { message: "È richiesto un ticker." }),
  name: z.string().min(1, { message: "È richiesto un nome." }),
  type: z.custom<AssetType>(),
  quantity: z.coerce.number().positive({ message: "La quantità deve essere un numero positivo." }),
  purchasePrice: z.coerce.number().positive({ message: "Il prezzo deve essere un numero positivo." }),
  currency: z.string().min(1, { message: "È richiesta una valuta." }),
  transactionDate: z.date({ required_error: "È richiesta una data di transazione." }),
});

export type AddAssetData = z.infer<typeof addAssetFormSchema>;

interface AddAssetDialogProps {
  children: ReactNode;
  onAssetAdd: (data: AddAssetData) => void;
}

export function AddAssetDialog({ children, onAssetAdd }: AddAssetDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);


  const form = useForm<AddAssetData>({
    resolver: zodResolver(addAssetFormSchema),
    defaultValues: {
      ticker: "",
      name: "",
      quantity: 0,
      purchasePrice: 0,
    },
  });

  useEffect(() => {
    if (!isOpen) {
      form.reset();
      setSearchTerm("");
      setSearchResults([]);
      setIsSearching(false);
      setIsSearchOpen(false);
    }
  }, [isOpen, form]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.length > 1) {
        setIsSearching(true);
        const results = await searchSecurities(searchTerm);
        setSearchResults(results);
        setIsSearching(false);
        if (results.length > 0) {
            setIsSearchOpen(true);
        }
      } else {
        setSearchResults([]);
        setIsSearchOpen(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleSelectSecurity = async (security: SearchResult) => {
    setSearchTerm(security.name || security.ticker);
    setIsSearchOpen(false);
    
    const quote = await getQuote(security.ticker);
    if (quote) {
      form.setValue("ticker", security.ticker);
      form.setValue("name", quote.name);
      form.setValue("purchasePrice", quote.price);
      form.setValue("currency", quote.currency);
      form.setValue("type", mapQuoteTypeToAssetType(security.type));
    }
  };

  function onSubmit(values: AddAssetData) {
    onAssetAdd(values);
    setIsOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Aggiungi Nuovo Asset</DialogTitle>
          <DialogDescription>
            Cerca un titolo (azione, ETF) da aggiungere al tuo portafoglio.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
             <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                <FormItem>
                  <FormLabel>Cerca un titolo</FormLabel>
                   <PopoverAnchor asChild>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                       <FormControl>
                          <Input
                            placeholder="Cerca per ticker o nome (es. AAPL, Apple)"
                            className="pl-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onFocus={() => searchTerm.length > 1 && setSearchResults.length > 0 && setIsSearchOpen(true)}
                          />
                       </FormControl>
                      {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />}
                    </div>
                   </PopoverAnchor>
                </FormItem>

                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandList>
                      {searchResults.length === 0 && !isSearching && <CommandEmpty>Nessun risultato.</CommandEmpty>}
                      <CommandGroup>
                        {searchResults.map((security) => (
                          <CommandItem
                            key={security.ticker}
                            value={`${security.ticker}-${security.name}`}
                            onSelect={() => handleSelectSecurity(security)}
                            className="cursor-pointer"
                          >
                           <div className="flex flex-col">
                             <span className="font-bold">{security.ticker}</span>
                             <span className="text-xs text-muted-foreground">{security.name}</span>
                           </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
            </Popover>
            
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => <Input type="hidden" {...field} />}
            />
             <FormField
              control={form.control}
              name="ticker"
              render={({ field }) => <Input type="hidden" {...field} />}
            />
             <FormField
              control={form.control}
              name="currency"
              render={({ field }) => <Input type="hidden" {...field} />}
            />

            {form.watch("ticker") && (
              <div className="space-y-4 rounded-md border bg-muted/50 p-4 animate-in fade-in-50">
                <p className="text-sm font-semibold text-foreground">
                  Dettagli per: <span className="text-primary">{form.watch("name")} ({form.watch("ticker")})</span>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantità</FormLabel>
                        <FormControl>
                          <Input type="number" step="any" placeholder="es. 10" {...field} />
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
                        <FormLabel>Prezzo d'acquisto ({form.watch("currency")})</FormLabel>
                        <FormControl>
                          <Input type="number" step="any" placeholder="es. 150.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                 <FormField
                  control={form.control}
                  name="transactionDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Data della transazione</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full justify-start text-left font-normal bg-background",
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
              </div>
            )}
            
            <DialogFooter>
              <Button type="submit" disabled={!form.formState.isValid || form.formState.isSubmitting}>
                Aggiungi Asset
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
