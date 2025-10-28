import { FileText, Calendar, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { StatusChip } from "./StatusChip";
import { Button } from "@/components/ui/button";

export interface Document {
  id: string;
  name: string;
  producer: string;
  location: string;
  date: string;
  status: "certified" | "pending" | "rejected";
  crop?: string;
}

interface DocumentCardProps {
  document: Document;
}

export const DocumentCard = ({ document }: DocumentCardProps) => {
  return (
    <Card className="hover:shadow-card transition-all hover:scale-[1.02] duration-300 bg-gradient-card border-border/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-primary flex-shrink-0" />
              <h3 className="font-semibold text-foreground truncate">{document.name}</h3>
            </div>
            
            <div className="space-y-1.5 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{document.producer} • {document.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{document.date}</span>
              </div>
              {document.crop && (
                <div className="inline-flex items-center px-2 py-0.5 rounded bg-accent/50 text-accent-foreground text-xs">
                  {document.crop}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <StatusChip status={document.status} />
            {document.status === "certified" ? (
              <Link to={`/certificate/${document.id}`}>
                <Button size="sm" variant="ghost" className="text-xs h-7">
                  View Details
                </Button>
              </Link>
            ) : (
              <Button size="sm" variant="pending" className="text-xs h-7">
                Certify Now
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
