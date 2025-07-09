
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GitBranch } from 'lucide-react';

export default function GitPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <GitBranch className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Pagina Git</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">
            Questa è una pagina segreta per gli sviluppatori. 🤫
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
