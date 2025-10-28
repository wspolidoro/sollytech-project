import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Copy, Download, Share2, Calendar, MapPin, User, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BlockchainBadge } from "@/components/BlockchainBadge";
import { StatusChip } from "@/components/StatusChip";
import { useToast } from "@/hooks/use-toast";
import soilTexture from "@/assets/soil-texture.jpg";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

const CertificateDetails = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const [qrCode, setQrCode] = useState("");

  // Mock certificate data
  const certificate = {
    id: id || "1",
    name: "Organic Coffee Certification 2024",
    producer: "Green Valley Farms",
    location: "São Paulo, Brazil",
    date: "2024-01-15",
    validUntil: "2025-01-15",
    status: "certified" as const,
    crop: "Arabica Coffee",
    area: "250 hectares",
    blockchainHash: "0x7d8f9a2b4c1e6f3a8d5c9e2b7f4a1c8d3e6f9a2b5c8e1f4a7d3c9e6b2f5a8c1d",
    certifiedBy: "AgriChain Validators",
    certificationDate: "2024-01-15T10:30:00Z",
  };

  useEffect(() => {
    // Generate QR code
    const url = window.location.href;
    QRCode.toDataURL(url, { width: 200, margin: 1 }).then(setQrCode);
  }, []);

  const copyHash = () => {
    navigator.clipboard.writeText(certificate.blockchainHash);
    toast({
      title: "Copied!",
      description: "Blockchain hash copied to clipboard",
    });
  };

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div 
        className="fixed inset-0 bg-cover bg-center opacity-10"
        style={{ backgroundImage: `url(${soilTexture})` }}
      />
      <div className="fixed inset-0 agro-pattern" />

      {/* Content */}
      <div className="relative z-10 min-h-screen pb-6">
        {/* Header */}
        <header className="glass border-b border-border/50 sticky top-0 z-20 mb-6">
          <div className="container mx-auto px-4 py-4">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4" />
                Back to Records
              </Button>
            </Link>
          </div>
        </header>

        <main className="container mx-auto px-4 space-y-6 max-w-2xl">
          {/* Certificate Header */}
          <Card className="glass border-2 border-border/50 shadow-card">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="text-xl mb-3">{certificate.name}</CardTitle>
                  <StatusChip status={certificate.status} />
                </div>
                <BlockchainBadge verified />
              </div>
            </CardHeader>
          </Card>

          {/* QR Code & Verification */}
          <Card className="glass border border-border/50">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4">
                {qrCode && (
                  <div className="p-4 bg-white rounded-lg shadow-soft">
                    <img src={qrCode} alt="QR Code" className="w-40 h-40" />
                  </div>
                )}
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground mb-1">
                    Scan to Verify Authenticity
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Verified on blockchain network
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Document Details */}
          <Card className="glass border border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Certificate Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-start gap-3">
                  <User className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Producer</p>
                    <p className="text-sm font-medium">{certificate.producer}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="text-sm font-medium">{certificate.location}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Package className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Crop / Area</p>
                    <p className="text-sm font-medium">{certificate.crop} • {certificate.area}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Valid Period</p>
                    <p className="text-sm font-medium">{certificate.date} → {certificate.validUntil}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Blockchain Hash */}
          <Card className="glass border border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Blockchain Proof</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Immutable Hash ID</p>
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border">
                    <code className="text-xs flex-1 overflow-hidden text-ellipsis font-mono">
                      {certificate.blockchainHash}
                    </code>
                    <Button size="icon" variant="ghost" onClick={copyHash} className="h-8 w-8 flex-shrink-0">
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground mb-1">Certified By</p>
                    <p className="font-medium">{certificate.certifiedBy}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Timestamp</p>
                    <p className="font-medium">
                      {new Date(certificate.certificationDate).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="hero" className="flex-1">
              <Download className="w-4 h-4" />
              Download PDF
            </Button>
            <Button variant="glass" className="flex-1">
              <Share2 className="w-4 h-4" />
              Share
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default CertificateDetails;
