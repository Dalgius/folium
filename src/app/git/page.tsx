
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Sprout, GitCommitHorizontal } from 'lucide-react';

const commits = [
  {
    hash: 'c15e1d0',
    message: 'Style: Align portfolio summary components',
    date: '3 ore fa',
    branch: 'main',
  },
  {
    hash: 'a9b4f2e',
    message: 'Feat: Implement historical data chart',
    date: '1 giorno fa',
    branch: 'feature/charts',
  },
  {
    hash: '3d8c7a1',
    message: 'Fix: Correct asset deletion logic',
    date: '2 giorni fa',
    branch: 'hotfix/delete-bug',
  },
  {
    hash: 'f4a6b9e',
    message: 'Feat: Add asset tracking',
    date: '4 giorni fa',
    branch: 'main',
  },
  {
    hash: '1b3d5c7',
    message: 'Initial commit: Plant the seed for Folium',
    date: '1 settimana fa',
    branch: 'main',
  }
];

export default function GitPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-full border border-primary/20">
                <Sprout className="h-8 w-8 text-primary" />
            </div>
            <div>
                <CardTitle className="text-2xl font-bold">Folium Version Control</CardTitle>
                <CardDescription>Cronologia delle modifiche recenti al progetto.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {commits.map((commit, index) => (
              <div key={commit.hash}>
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <GitCommitHorizontal className="h-5 w-5 text-muted-foreground" />
                    {index < commits.length - 1 && (
                      <div className="w-px h-16 bg-border mt-1"></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{commit.message}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <span>Commit <span className="font-mono text-xs">{commit.hash}</span></span>
                      <Separator orientation="vertical" className="h-4" />
                      <span>{commit.date}</span>
                      <Separator orientation="vertical" className="h-4" />
                      <Badge variant={commit.branch === 'main' ? 'default' : 'secondary'}>{commit.branch}</Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
