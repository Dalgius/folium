
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Bot, Sparkles } from "lucide-react";

import { type Asset } from "@/types";
import { investmentSuggestions } from "@/ai/flows/investment-suggestions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/utils";

const formSchema = z.object({
  riskTolerance: z.enum(["low", "medium", "high"], {
    errorMap: () => ({ message: "Please select a risk tolerance." }),
  }),
  investmentGoals: z.string().min(10, {
    message: "Please describe your investment goals (at least 10 characters).",
  }),
});

interface InvestmentAdvisorProps {
  assets: Asset[];
}

export function InvestmentAdvisor({ assets }: InvestmentAdvisorProps) {
  const [suggestions, setSuggestions] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      riskTolerance: "medium",
      investmentGoals: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setError(null);
    setSuggestions(null);

    const portfolioSummary = assets
      .map(
        (asset) =>
          `${asset.name} (${asset.type}): ${formatCurrency(asset.currentValue)}`
      )
      .join(", ");

    try {
      const result = await investmentSuggestions({
        portfolioData: `Current assets: ${portfolioSummary || "No assets yet."}`,
        riskTolerance: values.riskTolerance,
        investmentGoals: values.investmentGoals,
      });
      setSuggestions(result.suggestions);
    } catch (e) {
      console.error(e);
      setError("An error occurred while getting suggestions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl font-headline">AI Investment Advisor</CardTitle>
            <CardDescription>
              Get personalized investment suggestions based on your portfolio and goals.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="riskTolerance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Risk Tolerance</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your risk tolerance" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="investmentGoals"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Investment Goals</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Long-term growth, saving for a house, retirement in 20 years..."
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isLoading || assets.length === 0}>
              {isLoading ? "Analyzing..." : "Get Suggestions"}
              <Sparkles className="ml-2 h-4 w-4" />
            </Button>
            {assets.length === 0 && (
                <p className="pt-2 text-sm text-muted-foreground">Add some assets to your portfolio to use the AI Advisor.</p>
            )}
          </CardContent>
        </form>
      </Form>
      {(isLoading || suggestions || error) && (
        <CardFooter className="flex flex-col items-start gap-4 border-t bg-muted/50 px-6 py-4">
          {isLoading && (
            <div className="w-full space-y-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {suggestions && (
            <div>
              <h3 className="mb-2 font-semibold text-foreground">
                AI-Powered Suggestions
              </h3>
              <blockquote className="border-l-2 border-primary pl-4 text-sm text-muted-foreground">
                {suggestions}
              </blockquote>
            </div>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
