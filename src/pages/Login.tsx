import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Leaf } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import heroFarm from "@/assets/hero-farm.jpg";
import logoIcon from "@/assets/logo-icon.png";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simple validation demo
    if (email && password) {
      toast({
        title: "Login Successful",
        description: "Welcome to AllyChain Docs",
      });
      navigate("/dashboard");
    } else {
      toast({
        title: "Login Failed",
        description: "Please enter valid credentials",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroFarm})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/70 to-secondary/80" />
      </div>

      {/* Animated Background Elements */}
      <div className="absolute inset-0 agro-pattern" />

      {/* Login Card */}
      <Card className="relative z-10 w-full max-w-md mx-4 glass border-2 border-white/20 shadow-float">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="relative">
              <img src={logoIcon} alt="AllyChain" className="w-20 h-20 animate-float" />
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-glow" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold bg-gradient-hero bg-clip-text text-transparent">
              AllyChain Docs
            </CardTitle>
            <CardDescription className="text-foreground/80 font-medium">
              Blockchain Certificate Manager
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/90"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white/90"
              />
            </div>

            <Button type="submit" variant="hero" className="w-full" size="lg">
              <Lock className="w-4 h-4" />
              Access Platform
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-foreground/60">
            <Leaf className="w-3 h-3 text-accent" />
            <span>Secured by Blockchain Technology</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
