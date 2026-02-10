#!/bin/bash

set -e

echo "Iniciando instalação de dependências"

FABRIC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "$FABRIC_DIR"

# Função para verificar se um comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Função para verificar versão do Go
check_go_version() {
    if command_exists go; then
        GO_VERSION=$(go version | grep -o 'go[0-9]\+\.[0-9]\+' | sed 's/go//')
        REQUIRED_VERSION="1.21"
        
        if [ $(echo "$GO_VERSION >= $REQUIRED_VERSION" | bc -l) -eq 1 ]; then
            echo "Go versão $GO_VERSION (atende aos requisitos)"
            return 0
        else
            echo "Go versão $GO_VERSION é inferior à requerida (1.21+)"
            return 1
        fi
    else
        echo "Go não instalado"
        return 1
    fi
}

# Função para instalar Go
install_go() {
    echo "Instalando Go 1.21+..."
    
    sudo snap install go --classic

    # Configura PATH (se ainda não estiver configurado)
    if ! grep -q '/usr/local/go/bin' ~/.bashrc; then
        echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
    fi
    export PATH=$PATH:/usr/local/go/bin
    export GOWORK=off
    
    # Recarrega o bashrc
    source ~/.bashrc

    echo "Go instalado com sucesso"
}

# Função para instalar Node.js e npm
install_nodejs() {
    echo "Instalando Node.js e npm..."
    
    # Instala curl se não existir
    if ! command_exists curl; then
        sudo apt-get update && sudo apt-get install -y curl
    fi

    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

    # in lieu of restarting the shell
    \. "$HOME/.nvm/nvm.sh"

    # Download and install Node.js:
    nvm install 24

    # Verify the Node.js version:
    node -v

    # Verify npm version:
    npm -v

}

# Função para verificar Docker
check_docker() {
    if command_exists docker && command_exists docker-compose; then
        DOCKER_VERSION=$(docker --version | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+')
        DOCKER_COMPOSE_VERSION=$(docker-compose --version | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+')
        
        echo "Docker versão $DOCKER_VERSION"
        echo "Docker Compose versão $DOCKER_COMPOSE_VERSION"
        return 0
    else
        echo "Docker ou Docker Compose não instalados"
        return 1
    fi
}

# Função para instalar Docker
install_docker() {
    echo "Instalando Docker e Docker Compose..."
    
    # Instala Docker
    sudo snap install docker
    
    # Adiciona usuário ao grupo docker
    sudo groupadd docker
    sudo usermod -aG docker $USER

    echo "Docker e Docker Compose instalados"
}

install_fabric() {
    FABRIC_INSTALL_DIR="/usr/local/fabric"
    FABRIC_BIN_DIR="$FABRIC_INSTALL_DIR/bin"
    SCRIPT_URL="https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh"

    sudo mkdir -p "$FABRIC_INSTALL_DIR"
    sudo chown "$USER":"$USER" "$FABRIC_INSTALL_DIR"
    cd "$FABRIC_INSTALL_DIR"

    curl -sSLO "$SCRIPT_URL"
    chmod +x install-fabric.sh

    ./install-fabric.sh b

    if ! grep -q "$FABRIC_BIN_DIR" /etc/profile; then
        echo "export PATH=\$PATH:$FABRIC_BIN_DIR" | sudo tee -a /etc/profile
    fi

    export PATH=$PATH:$FABRIC_BIN_DIR

    cd "$FABRIC_DIR"
}

# Função para instalar dependências do projeto
install_project_dependencies() {
    echo "Instalando dependências do projeto..."
    
    # Instala dependências do chaincode
    if [ -d "chaincode" ]; then
        echo "Instalando dependências do chaincode..."
        cd chaincode
        go mod tidy
        go mod vendor
        cd ..
    else
        echo "Diretório 'chaincode' não encontrado"
    fi
    
    # Instala dependências da API
    if [ -d "ccapi" ]; then
        echo "Instalando dependências da ccapi..."
        cd ccapi
        go mod tidy
        go mod vendor
        cd ..
    else
        echo "Diretório 'ccapi' não encontrado"
    fi
    
    # Instala dependências Node.js
    cd client
    npm i
    
    # Instala dependências do app se existir
    if [ -d "app" ] && [ -f "app/package.json" ]; then
        echo "Instalando dependências do app..."
        cd app
        npm install
        cd ..
    fi
    
    echo "dependências instaladas"
}

# Executa as instalações
echo ""
echo "1. Verificando Go..."
if ! check_go_version; then
    install_go
fi

echo ""
echo "2. Verificando Node.js e npm..."
if ! command_exists node || ! command_exists npm; then
    install_nodejs
else
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    echo "Node.js $NODE_VERSION"
    echo "npm $NPM_VERSION"
fi

echo ""
echo "3. Verificando Docker..."
if ! check_docker; then
    install_docker
fi

echo ""
echo "4. Instalando binários do fabric"
install_fabric
cd "$FABRIC_DIR"

echo ""
echo "5. Instalando dependências do projeto..."
cd ..
install_project_dependencies

source /etc/profile

# Verifica se o Docker foi instalado durante o script
DOCKER_INSTALADO=false
if command_exists docker && ! docker version > /dev/null 2>&1; then
    DOCKER_INSTALADO=true
fi

if [ "$DOCKER_INSTALADO" = true ] || ! docker version > /dev/null 2>&1; then
    echo "Instalação concluida!"
    echo "Para aplicar algumas alterações, o dispositivo precisa ser reiniciado"
    echo ""
    
    while true; do
        read -p "Deseja reiniciar agora? (s/N): " resposta
        case $resposta in
            [Ss]* ) 
                echo "Reiniciando a máquina..."
                sudo shutdown -r now
                exit 0
                ;;
            [Nn]* | "" ) 
                break
                ;;
            * ) 
                echo "Escolha inválida. Reinicie assim que possível."
                ;;
        esac
    done
else
    echo "Toda a instalação foi concluída"
fi