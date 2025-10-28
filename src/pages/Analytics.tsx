import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, PieChart, Pie, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import soilTexture from "@/assets/soil-texture.jpg";

import { TrendingUp, TrendingDown, FileCheck, Clock, Shield, Leaf } from "lucide-react";
const certificationTrendData = [
  { mes: "Jan", certificados: 12, pendentes: 5 },
  { mes: "Fev", certificados: 19, pendentes: 3 },
  { mes: "Mar", certificados: 15, pendentes: 8 },
  { mes: "Abr", certificados: 25, pendentes: 4 },
  { mes: "Mai", certificados: 22, pendentes: 6 },
  { mes: "Jun", certificados: 30, pendentes: 2 },
];

const cropDistributionData = [
  { name: "Café", value: 35, color: "#0077FF" },
  { name: "Soja", value: 28, color: "#1E7A3E" },
  { name: "Milho", value: 20, color: "#8C6239" },
  { name: "Algodão", value: 17, color: "#29CC6A" },
];

const producerRankingData = [
  { producer: "Fazenda Vale Verde", total: 24 },
  { producer: "EcoAgro Soluções", total: 18 },
  { producer: "Terra Nova Agrícola", total: 15 },
  { producer: "Guardiões do Solo", total: 12 },
  { producer: "AgroTech Orgânicos", total: 8 },
];

const regionData = [
  { name: "São Paulo", value: 32 },
  { name: "Mato Grosso", value: 25 },
  { name: "Paraná", value: 18 },
  { name: "Goiás", value: 15 },
  { name: "Outros", value: 10 },
];

const Analytics = () => {
  const [timeRange, setTimeRange] = useState("mes");
  const [statusFilter, setStatusFilter] = useState("todos");

  const totalDocuments = 127;
  const certifiedDocs = 93;
  const pendingDocs = 34;
  const certificationRate = ((certifiedDocs / totalDocuments) * 100).toFixed(1);
  const blockchainSuccessRate = 99.2;

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div 
        className="fixed inset-0 bg-cover bg-center opacity-10"
        style={{ backgroundImage: `url(${soilTexture})` }}
      />
      <div className="fixed inset-0 agro-pattern" />

      {/* Content */}
      <div className="relative z-10 min-h-screen">
        {/* Main Content */}
        <main className="container mx-auto px-4 py-6 space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
              <p className="text-sm text-muted-foreground">Métricas e Inteligência Operacional</p>
            </div>
            <Button variant="glass" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          </div>

          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[140px] bg-white/90">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semana">Última Semana</SelectItem>
                <SelectItem value="mes">Último Mês</SelectItem>
                <SelectItem value="trimestre">Trimestre</SelectItem>
                <SelectItem value="ano">Ano</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] bg-white/90">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="certificados">Certificados</SelectItem>
                <SelectItem value="pendentes">Pendentes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="glass border-border/50 hover-scale animate-fade-in">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <FileCheck className="w-5 h-5 text-primary animate-pulse" />
                  <div className="flex items-center gap-1 text-success text-xs">
                    <TrendingUp className="w-3 h-3" />
                    +12%
                  </div>
                </div>
                <div className="text-2xl font-bold text-foreground">{totalDocuments}</div>
                <div className="text-xs text-muted-foreground">Total de Documentos</div>
              </CardContent>
            </Card>

            <Card className="glass border-border/50 hover-scale animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <Shield className="w-5 h-5 text-success animate-pulse" />
                  <div className="flex items-center gap-1 text-success text-xs">
                    <TrendingUp className="w-3 h-3" />
                    +8%
                  </div>
                </div>
                <div className="text-2xl font-bold text-success">{certifiedDocs}</div>
                <div className="text-xs text-muted-foreground">Certificados</div>
              </CardContent>
            </Card>

            <Card className="glass border-border/50 hover-scale animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  <div className="flex items-center gap-1 text-destructive text-xs">
                    <TrendingDown className="w-3 h-3" />
                    -3%
                  </div>
                </div>
                <div className="text-2xl font-bold text-foreground">{pendingDocs}</div>
                <div className="text-xs text-muted-foreground">Pendentes</div>
              </CardContent>
            </Card>

            <Card className="glass border-border/50 hover-scale animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <Leaf className="w-5 h-5 text-primary animate-pulse" />
                  <div className="flex items-center gap-1 text-success text-xs">
                    <TrendingUp className="w-3 h-3" />
                    +2%
                  </div>
                </div>
                <div className="text-2xl font-bold text-foreground">{certificationRate}%</div>
                <div className="text-xs text-muted-foreground">Taxa de Certificação</div>
              </CardContent>
            </Card>
          </div>

          {/* Certification Trend Chart */}
          <Card className="glass border-border/50 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <CardHeader>
              <CardTitle className="text-foreground">Certificações ao Longo do Tempo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={certificationTrendData}>
                    <defs>
                      <linearGradient id="colorCertificados" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        boxShadow: 'var(--shadow-elegant)'
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="certificados" 
                      stroke="hsl(var(--success))" 
                      strokeWidth={3}
                      name="Certificados"
                      dot={{ fill: 'hsl(var(--success))', strokeWidth: 2, r: 5 }}
                      activeDot={{ r: 8, strokeWidth: 2 }}
                      animationDuration={1500}
                      animationBegin={0}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="pendentes" 
                      stroke="hsl(var(--muted-foreground))" 
                      strokeWidth={3}
                      name="Pendentes"
                      dot={{ fill: 'hsl(var(--muted-foreground))', strokeWidth: 2, r: 5 }}
                      activeDot={{ r: 8, strokeWidth: 2 }}
                      animationDuration={1500}
                      animationBegin={200}
                      strokeDasharray="5 5"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Distribution Charts */}
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Crop Distribution */}
            <Card className="glass border-border/50 animate-fade-in hover-scale" style={{ animationDelay: '0.5s' }}>
              <CardHeader>
                <CardTitle className="text-foreground">Distribuição por Cultura</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={cropDistributionData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        animationBegin={0}
                        animationDuration={1200}
                        animationEasing="ease-out"
                      >
                        {cropDistributionData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.color}
                            className="transition-all duration-300 hover:opacity-80"
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          boxShadow: 'var(--shadow-elegant)'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Region Distribution */}
            <Card className="glass border-border/50 animate-fade-in hover-scale" style={{ animationDelay: '0.6s' }}>
              <CardHeader>
                <CardTitle className="text-foreground">Certificações por Região</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={regionData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        animationBegin={200}
                        animationDuration={1200}
                        animationEasing="ease-out"
                      >
                        {regionData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={cropDistributionData[index % cropDistributionData.length].color}
                            className="transition-all duration-300 hover:opacity-80"
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          boxShadow: 'var(--shadow-elegant)'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Producer Ranking */}
          <Card className="glass border-border/50 animate-fade-in" style={{ animationDelay: '0.7s' }}>
            <CardHeader>
              <CardTitle className="text-foreground">Ranking de Produtores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={producerRankingData} layout="vertical">
                    <defs>
                      <linearGradient id="colorBar" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1}/>
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.6}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                    <YAxis dataKey="producer" type="category" stroke="hsl(var(--muted-foreground))" width={150} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        boxShadow: 'var(--shadow-elegant)'
                      }}
                    />
                    <Bar 
                      dataKey="total" 
                      fill="url(#colorBar)" 
                      name="Certificados"
                      radius={[0, 8, 8, 0]}
                      animationDuration={1200}
                      animationBegin={0}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Blockchain Performance */}
          <Card className="glass border-border/50 animate-fade-in" style={{ animationDelay: '0.8s' }}>
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Shield className="w-5 h-5 text-success animate-pulse" />
                Performance Blockchain
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Taxa de Sucesso de Transações</span>
                <span className="text-2xl font-bold text-success">{blockchainSuccessRate}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div 
                  className="h-full bg-gradient-success transition-all duration-1000 animate-fade-in"
                  style={{ width: `${blockchainSuccessRate}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="glass p-3 rounded-lg border border-border/30 hover-scale">
                  <div className="text-xs text-muted-foreground">Registros Imutáveis</div>
                  <div className="text-xl font-bold text-foreground">{certifiedDocs}</div>
                </div>
                <div className="glass p-3 rounded-lg border border-border/30 hover-scale">
                  <div className="text-xs text-muted-foreground">Tempo Médio</div>
                  <div className="text-xl font-bold text-foreground">2.3s</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default Analytics;
