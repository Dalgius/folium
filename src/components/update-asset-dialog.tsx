"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useEffect, useState, type ReactNode } from "react";

import { Asset } from "@/types";
import { formatCurrency } from "@/lib/utils";
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
  currentValue: z.coerce.number().positive({
    message: "Value must be a positive number.",
  }),
});

interface UpdateAssetDialogProps {
  children: ReactNode;
  asset: Asset;
  onAssetUpdate: (id: string, newCurrentValue: number) => void;
}

export function UpdateAssetDialog({ children, asset, onAssetUpdate }: UpdateAssetDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currentValue: asset.currentValue,
    },
  });
  
  // Reset form with current asset value when dialog opens
  useEffect(() => {
    if (isOpen) {
      form.reset({ currentValue: asset.currentValue });
    }
  }, [isOpen, asset.currentValue, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    onAssetUpdate(asset.id, values.currentValue);
    setIsOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Update Asset: {asset.name}</DialogTitle>
          <DialogDescription>
            Enter the new current value for this asset. The previous value was {formatCurrency(asset.currentValue)}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="currentValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Current Value</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">$</span>
                      <Input type="number" placeholder="1000.00" className="pl-7" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Update Value</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
