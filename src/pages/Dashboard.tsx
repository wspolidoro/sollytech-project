import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Filter, Plus, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DocumentCard, Document } from "@/components/DocumentCard";
import soilTexture from "@/assets/soil-texture.jpg";
import logoIcon from "@/assets/logo-icon.png";

// Mock data
const mockDocuments: Document[] = [
  {
    id: "1",
    name: "Certificação de Café Orgânico 2024",
    producer: "Fazenda Vale Verde",
    location: "São Paulo, Brasil",
    date: "15/01/2024",
    status: "certified",
    crop: "Café",
  },
  {
    id: "2",
    name: "Relatório de Soja Sustentável",
    producer: "EcoAgro Soluções",
    location: "Mato Grosso, Brasil",
    date: "20/01/2024",
    status: "certified",
    crop: "Soja",
  },
  {
    id: "3",
    name: "Conformidade Ambiental T1",
    producer: "Terra Nova Agrícola",
    location: "Paraná, Brasil",
    date: "25/01/2024",
    status: "pending",
    crop: "Milho",
  },
  {
    id: "4",
    name: "Auditoria de Agricultura Regenerativa",
    producer: "Guardiões do Solo",
    location: "Goiás, Brasil",
    date: "01/02/2024",
    status: "certified",
    crop: "Algodão",
  },
];

const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  const filteredDocuments = mockDocuments.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.producer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div 
        className="fixed inset-0 bg-cover bg-center opacity-10"
        style={{ backgroundImage: `url(${soilTexture})` }}
      />
      <div className="fixed inset-0 agro-pattern" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="glass border-b border-border/50 sticky top-0 z-20">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={logoIcon} alt="AllyChain" className="w-10 h-10" />
                <div>
                  <h1 className="text-xl font-bold text-foreground">AllyChain Docs</h1>
                  <p className="text-xs text-muted-foreground">Gerenciador de Certificados</p>
                </div>
              </div>
              <Link to="/">
                <Button variant="ghost" size="icon">
                  <LogOut className="w-5 h-5" />
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 container mx-auto px-4 py-6 pb-24">
          {/* Search Bar */}
          <div className="mb-6 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar documentos, produtores..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/90"
              />
            </div>
            <Button 
              variant="glass" 
              size="icon"
              onClick={() => setFilterOpen(!filterOpen)}
            >
              <Filter className="w-4 h-4" />
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="glass p-4 rounded-xl border border-border/50">
              <div className="text-2xl font-bold text-success">
                {mockDocuments.filter(d => d.status === "certified").length}
              </div>
              <div className="text-xs text-muted-foreground">Certificados</div>
            </div>
            <div className="glass p-4 rounded-xl border border-border/50">
              <div className="text-2xl font-bold text-muted-foreground">
                {mockDocuments.filter(d => d.status === "pending").length}
              </div>
              <div className="text-xs text-muted-foreground">Pendentes</div>
            </div>
          </div>

          {/* Documents List */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground mb-3">
              Todos os Registros ({filteredDocuments.length})
            </h2>
            {filteredDocuments.map((doc) => (
              <DocumentCard key={doc.id} document={doc} />
            ))}
          </div>
        </main>

        {/* FAB */}
        <Link to="/add" className="fixed bottom-6 right-6 z-30">
          <Button 
            size="lg" 
            variant="hero" 
            className="rounded-full w-14 h-14 shadow-float"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;
