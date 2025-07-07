'use server';

/**
 * @fileOverview AI-powered investment suggestions based on portfolio analysis.
 *
 * - investmentSuggestions - A function that provides investment suggestions.
 * - InvestmentSuggestionsInput - The input type for the investmentSuggestions function.
 * - InvestmentSuggestionsOutput - The return type for the investmentSuggestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const InvestmentSuggestionsInputSchema = z.object({
  portfolioData: z.string().describe('The current investment portfolio data.'),
  riskTolerance: z.string().describe('The risk tolerance of the investor (e.g., low, medium, high).'),
  investmentGoals: z.string().describe('The investment goals of the investor (e.g., retirement, growth, income).'),
});
export type InvestmentSuggestionsInput = z.infer<typeof InvestmentSuggestionsInputSchema>;

const InvestmentSuggestionsOutputSchema = z.object({
  suggestions: z.string().describe('AI-powered investment suggestions based on the portfolio analysis.'),
});
export type InvestmentSuggestionsOutput = z.infer<typeof InvestmentSuggestionsOutputSchema>;

export async function investmentSuggestions(input: InvestmentSuggestionsInput): Promise<InvestmentSuggestionsOutput> {
  return investmentSuggestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'investmentSuggestionsPrompt',
  input: {schema: InvestmentSuggestionsInputSchema},
  output: {schema: InvestmentSuggestionsOutputSchema},
  prompt: `You are an AI investment advisor. Provide investment suggestions based on the investor's portfolio data, risk tolerance, and investment goals.  Be succinct.

Portfolio Data: {{{portfolioData}}}
Risk Tolerance: {{{riskTolerance}}}
Investment Goals: {{{investmentGoals}}}

Suggestions:`, 
});

const investmentSuggestionsFlow = ai.defineFlow(
  {
    name: 'investmentSuggestionsFlow',
    inputSchema: InvestmentSuggestionsInputSchema,
    outputSchema: InvestmentSuggestionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
