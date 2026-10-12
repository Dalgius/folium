'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { AlertCircle, CheckCircle2, Landmark, LineChart, Loader2, PiggyBank } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { FoliumLogo } from '@/components/folium-logo';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TextField } from '@/components/forms/fields';
import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

type Mode = 'login' | 'signup';

const schema = z.object({
  email: z.string().trim().email('Inserisci un indirizzo email valido'),
  password: z.string().min(6, 'La password deve contenere almeno 6 caratteri'),
});

const ERRORS: Record<string, string> = {
  'auth/invalid-credential': 'Credenziali non valide. Controlla email e password.',
  'auth/user-not-found': 'Credenziali non valide. Controlla email e password.',
  'auth/wrong-password': 'Credenziali non valide. Controlla email e password.',
  'auth/email-already-in-use': 'Esiste già un account con questa email.',
  'auth/too-many-requests': 'Troppi tentativi. Riprova tra qualche minuto.',
  'auth/network-request-failed': 'Connessione assente. Controlla la rete e riprova.',
  'auth/weak-password': 'La password è troppo debole.',
};

const COPY: Record<Mode, { title: string; subtitle: string; cta: string; busy: string }> = {
  login: { title: 'Bentornato', subtitle: 'Accedi per vedere il tuo patrimonio.', cta: 'Accedi', busy: 'Accesso in corso…' },
  signup: { title: 'Crea il tuo account', subtitle: 'Inizia a monitorare conti e investimenti.', cta: 'Registrati', busy: 'Creazione in corso…' },
};

const FEATURES = [
  { icon: Landmark, text: 'Conti correnti e depositi, con interessi e scadenze' },
  { icon: LineChart, text: 'ETF, azioni, fondi e crypto con prezzi aggiornati' },
  { icon: PiggyBank, text: 'Il patrimonio netto e come cresce nel tempo' },
];

export function AuthForm({ mode }: { mode: Mode }) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const copy = COPY[mode];

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  async function submit({ email, password }: z.infer<typeof schema>) {
    setError(null);
    setNotice(null);
    try {
      if (mode === 'login') await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
      // Il reindirizzamento è gestito da AuthProvider
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      setError(ERRORS[code] ?? 'Si è verificato un errore. Riprova.');
    }
  }

  async function resetPassword() {
    const email = form.getValues('email');
    if (!schema.shape.email.safeParse(email).success) {
      form.setError('email', { message: 'Inserisci la tua email per reimpostare la password' });
      return;
    }
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setNotice(`Ti abbiamo inviato un'email a ${email.trim()} per reimpostare la password.`);
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      setError(ERRORS[code] ?? "Impossibile inviare l'email di recupero.");
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/5 blur-3xl" aria-hidden />
        <div className="relative flex items-center gap-3">
          <span className="rounded-xl bg-white p-1.5"><Image src="/logo.png?v=2" alt="" width={32} height={32} /></span>
          <FoliumLogo className="h-7 w-auto text-white" aria-label="Folium" />
        </div>
        <div className="relative space-y-8">
          <h2 className="max-w-md text-4xl font-semibold leading-tight tracking-tight">Tutto il tuo patrimonio, in un colpo d&apos;occhio.</h2>
          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-primary-foreground/90">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10"><Icon className="h-4 w-4" /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-primary-foreground/70">I tuoi dati sono visibili solo a te.</p>
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex items-center gap-2.5 lg:hidden">
            <Image src="/logo.png?v=2" alt="" width={36} height={36} />
            <FoliumLogo className="h-7 w-auto text-primary" aria-label="Folium" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
            <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {notice && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
              <TextField control={form.control} name="email" label="Email" placeholder="nome@email.com" autoFocus />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Password</FormLabel>
                      {mode === 'login' && (
                        <button type="button" onClick={resetPassword} className="text-xs font-medium text-primary hover:underline">
                          Password dimenticata?
                        </button>
                      )}
                    </div>
                    <FormControl>
                      <Input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
                {form.formState.isSubmitting ? copy.busy : copy.cta}
              </Button>
            </form>
          </Form>

          <p className="text-center text-sm text-muted-foreground">
            {mode === 'login' ? 'Non hai un account? ' : 'Hai già un account? '}
            <Link href={mode === 'login' ? '/signup' : '/login'} className="font-medium text-primary hover:underline">
              {mode === 'login' ? 'Registrati' : 'Accedi'}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
