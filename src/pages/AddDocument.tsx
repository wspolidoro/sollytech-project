import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import soilTexture from "@/assets/soil-texture.jpg";

const AddDocument = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    producer: "",
    location: "",
    crop: "",
    area: "",
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate blockchain certification
    await new Promise(resolve => setTimeout(resolve, 2000));

    toast({
      title: "Certificado Criado!",
      description: "Documento ancorado com sucesso na blockchain",
    });

    setIsSubmitting(false);
    navigate("/dashboard");
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
                Voltar ao Painel
              </Button>
            </Link>
          </div>
        </header>

        <main className="container mx-auto px-4 max-w-2xl">
          <Card className="glass border-2 border-border/50 shadow-card">
            <CardHeader>
              <CardTitle className="text-xl">Certificar Novo Documento</CardTitle>
              <p className="text-sm text-muted-foreground">
                Registre e ancore seu documento na blockchain
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* File Upload */}
                <div className="space-y-2">
                  <Label>Upload do Documento</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer bg-muted/20">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-1">
                      Clique para fazer upload ou arraste e solte
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PDF, PNG, JPG (máx 10MB)
                    </p>
                  </div>
                </div>

                {/* Document Details */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Documento *</Label>
                    <Input
                      id="name"
                      placeholder="ex: Certificação de Café Orgânico 2024"
                      value={formData.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      required
                      className="bg-white/90"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="producer">Produtor / Nome da Fazenda *</Label>
                    <Input
                      id="producer"
                      placeholder="ex: Fazenda Vale Verde"
                      value={formData.producer}
                      onChange={(e) => handleChange("producer", e.target.value)}
                      required
                      className="bg-white/90"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Localização *</Label>
                    <Input
                      id="location"
                      placeholder="ex: São Paulo, Brasil"
                      value={formData.location}
                      onChange={(e) => handleChange("location", e.target.value)}
                      required
                      className="bg-white/90"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="crop">Tipo de Cultura</Label>
                      <Input
                        id="crop"
                        placeholder="ex: Café"
                        value={formData.crop}
                        onChange={(e) => handleChange("crop", e.target.value)}
                        className="bg-white/90"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="area">Área (hectares)</Label>
                      <Input
                        id="area"
                        placeholder="ex: 250"
                        value={formData.area}
                        onChange={(e) => handleChange("area", e.target.value)}
                        className="bg-white/90"
                      />
                    </div>
                  </div>
                </div>

                {/* Info Box */}
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-primary">Segurança Blockchain:</span> Seu documento 
                    será ancorado em uma rede blockchain imutável, garantindo verificação permanente 
                    e certificação à prova de adulteração.
                  </p>
                </div>

                {/* Submit Button */}
                <Button 
                  type="submit" 
                  variant="hero" 
                  size="lg" 
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Certificando na Blockchain...
                    </>
                  ) : (
                    "Certificar na Blockchain"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default AddDocument;
