
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from 'next/link';
import { Leaf, AlertCircle } from 'lucide-react';

import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


const formSchema = z.object({
  email: z.string().email({ message: "Inserisci un indirizzo email valido." }),
  password: z.string().min(6, { message: "La password deve contenere almeno 6 caratteri." }),
});

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleSignup = async (values: z.infer<typeof formSchema>) => {
    try {
      await createUserWithEmailAndPassword(auth, values.email, values.password);
      router.push("/");
    } catch (e: any) {
      console.error(e);
      let errorMessage = "Si è verificato un errore durante la registrazione.";
      if (e.code === 'auth/email-already-in-use') {
        errorMessage = "Questo indirizzo email è già in uso.";
      }
      setError(errorMessage);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
            <div className="flex justify-center items-center mb-4">
                <Leaf className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Crea il tuo Account</CardTitle>
            <CardDescription>Registrati per iniziare a tracciare il tuo portafoglio in modo sicuro.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSignup)} className="space-y-4">
                    {error && (
                         <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Errore di Registrazione</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                                <Input type="email" placeholder="mario.rossi@email.com" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                                <Input type="password" placeholder="••••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting ? "Creazione in corso..." : "Registrati"}
                    </Button>
                </form>
            </Form>
        </CardContent>
        <CardFooter className="flex flex-col items-center gap-2">
            <p className="text-sm text-muted-foreground">
                Hai già un account?{' '}
                <Link href="/login" className="font-medium text-primary hover:underline">
                    Accedi
                </Link>
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}
