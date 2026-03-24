#!/bin/bash

# 🚀 SafeStep Quick Start Guide with Authentication
# Ce script lance le backend MongoDB + Auth et ouvre le frontend

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   🦿 SafeStep - Quick Start with Authentication          ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Déterminer le chemin du script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_URL="http://localhost:3001"

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé."
    echo "📥 Installez Node.js depuis https://nodejs.org"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo ""

# Vérifier si MongoDB est installé
echo "🔍 Vérification de MongoDB..."
if ! command -v mongosh &> /dev/null && ! command -v mongo &> /dev/null; then
    echo "⚠️  MongoDB n'est pas installé."
    echo ""
    echo "Options:"
    echo "  1. Installer MongoDB localement (recommandé):"
    if [[ "$(uname)" == "Linux" ]]; then
        echo "     sudo apt-get install -y gnupg curl"
        echo "     curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor"
        echo "     echo \"deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse\" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list"
        echo "     sudo apt-get update && sudo apt-get install -y mongodb-org"
        echo "     sudo systemctl enable --now mongod"
    else
        echo "     brew tap mongodb/brew"
        echo "     brew install mongodb-community"
        echo "     brew services start mongodb-community"
    fi
    echo ""
    echo "  2. Utiliser MongoDB Atlas (cloud gratuit):"
    echo "     https://www.mongodb.com/cloud/atlas"
    echo ""
    read -p "Voulez-vous continuer sans MongoDB? (y/N): " continue_without_mongo
    if [[ ! $continue_without_mongo =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ MongoDB installé"
    
    # Vérifier si MongoDB est en cours d'exécution
    if pgrep -x "mongod" > /dev/null; then
        echo "✅ MongoDB est en cours d'exécution"
    else
        echo "⚠️  MongoDB n'est pas en cours d'exécution"
        echo "🚀 Démarrage de MongoDB..."
        if [[ "$(uname)" == "Linux" ]]; then
            sudo systemctl start mongod 2>/dev/null || mongod --fork --logpath /tmp/mongodb.log 2>/dev/null
        else
            brew services start mongodb-community 2>/dev/null || mongod --fork --logpath /tmp/mongodb.log 2>/dev/null
        fi
        sleep 2
    fi
fi
echo ""

# Vérifier que le dossier backend existe
if [ ! -d "$BACKEND_DIR" ]; then
    echo "❌ Dossier backend non trouvé: $BACKEND_DIR"
    exit 1
fi

# Aller dans le dossier backend
cd "$BACKEND_DIR"
echo "📂 Dossier backend: $BACKEND_DIR"
echo ""

# Vérifier si .env existe
if [ ! -f ".env" ]; then
    echo "⚠️  Fichier .env non trouvé"
    if [ -f ".env.example" ]; then
        echo "📝 Création de .env à partir de .env.example..."
        cp .env.example .env
        echo "✅ Fichier .env créé avec succès"
    else
        echo "📝 Utilisation des valeurs par défaut..."
    fi
    echo ""
fi

# Vérifier si node_modules existe
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances npm..."
    npm install
    echo ""
fi

# Initialiser la base de données si nécessaire
echo "🗄️  Vérification de la base de données..."
if command -v mongosh &> /dev/null || command -v mongo &> /dev/null; then
    echo "📝 Initialisation des utilisateurs par défaut..."
    npm run init-db 2>/dev/null || echo "⚠️  Base de données déjà initialisée"
    echo ""
fi

# Démarrer le serveur en arrière-plan
echo "🚀 Démarrage du backend SafeStep avec Authentication..."
node server.js &
SERVER_PID=$!

# Attendre que le serveur soit prêt (poll sur le port 3001)
echo "⏳ Attente du backend..."
for i in $(seq 1 15); do
    sleep 1
    if curl -s http://localhost:3001/ > /dev/null 2>&1; then
        echo "✅ Backend prêt après ${i}s"
        break
    fi
done

# Vérifier que le serveur est en cours
if kill -0 $SERVER_PID 2>/dev/null; then
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║   ✅ Backend démarré avec succès!                        ║"
    echo "║                                                           ║"
    echo "║   🌐 API: http://localhost:3001                          ║"
    echo "║   🔌 WebSocket: ws://localhost:3001                      ║"
    echo "║   🔐 Authentication: JWT Enabled                         ║"
    echo "║   🗄️  Database: MongoDB                                  ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    
    # Choisir le bon interpréteur Python (venv prioritaire)
    if [ -f "$SCRIPT_DIR/.venv/bin/python" ]; then
        PYTHON="$SCRIPT_DIR/.venv/bin/python"
    else
        PYTHON="python3"
    fi

    # Lancer la BLE Gateway Python si bleak est disponible
    if $PYTHON -c "import bleak" 2>/dev/null; then
        echo "🦷 Démarrage BLE Gateway Python ($PYTHON)..."
        $PYTHON "$SCRIPT_DIR/ble-gateway.py" &
        BLE_PID=$!
        echo "   PID gateway: $BLE_PID"
    else
        echo "⚠️  BLE Gateway non disponible (bleak non installé)"
        echo "   → $PYTHON -m pip install bleak requests"
        echo "   → puis: $PYTHON ble-gateway.py"
    fi
    echo ""

    # Ouvrir le frontend via HTTP
    echo "📱 Ouverture du frontend sur $FRONTEND_URL ..."
    sleep 1
    if command -v xdg-open &> /dev/null; then
        xdg-open "$FRONTEND_URL"
    elif command -v open &> /dev/null; then
        open "$FRONTEND_URL"
    else
        echo "📝 Ouvrez manuellement: $FRONTEND_URL"
    fi
    
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║   ✨ SafeStep est maintenant en cours d'exécution!       ║"
    echo "║                                                           ║"
    echo "║   🔑 Credentials de connexion:                           ║"
    echo "║      Email: marie.joubert@email.com                      ║"
    echo "║      Password: Password123!                              ║"
    echo "║                                                           ║"
    echo "║   👉 Le frontend s'ouvrira avec une page de login        ║"
    echo "║   🟢 Connected = Authentification réussie                ║"
    echo "║                                                           ║"
    echo "║   📊 Les données se mettent à jour en temps réel         ║"
    echo "║   🚨 La détection de chute est active                    ║"
    echo "║   🆘 Le bouton SOS est fonctionnel                       ║"
    echo "║   🔐 Toutes les routes sont protégées par JWT            ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    echo "📝 Commandes utiles:"
    echo "   - Arrêter le serveur: ./stop-safestep.sh"
    echo "   - Arrêter manuellement: kill $SERVER_PID"
    echo "   - Voir les processus: ps aux | grep node"
    echo "   - MongoDB shell: mongosh"
    echo ""
    echo "💡 Pour arrêter proprement, utilisez: ./stop-safestep.sh"
    echo ""
    echo "🎯 Appuyez sur Ctrl+C pour arrêter le serveur"
    echo ""
    
    # Garder le script en cours pour voir les logs
    wait $SERVER_PID
else
    echo ""
    echo "❌ Erreur lors du démarrage du serveur"
    echo ""
    echo "💡 Vérifications:"
    if [[ "$(uname)" == "Linux" ]]; then
        echo "   1. MongoDB est-il en cours? → systemctl status mongod"
    else
        echo "   1. MongoDB est-il en cours? → brew services list"
    fi
    echo "   2. Le port 3001 est-il libre? → lsof -i :3001"
    echo "   3. Les dépendances sont-elles installées? → cd backend && npm install"
    echo "   4. Le fichier server.js existe? → ls -la backend/server.js"
    echo ""
    exit 1
fi
