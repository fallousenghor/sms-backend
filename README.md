# 📱 SMS Bulk — Backend API

Backend complet pour l'envoi de SMS groupés à vos clients. Construit avec **Node.js / TypeScript / Prisma / Neon / Twilio**, architecture modulaire respectant les principes **SOLID** et **DRY**, culture **DevOps** intégrée.

---

## 🏗️ Architecture

```
sms-bulk-backend/
├── prisma/
│   ├── schema.prisma          # Modèles DB (User, Client, Group, Campaign, SmsLog)
│   └── seed.ts                # Données de démarrage
├── src/
│   ├── index.ts               # Point d'entrée + graceful shutdown
│   ├── app.ts                 # Express app (cors, helmet, rate-limit, swagger)
│   ├── shared/
│   │   ├── config/
│   │   │   ├── index.ts       # Config typée + validation env vars
│   │   │   ├── prisma.ts      # Singleton PrismaClient
│   │   │   └── swagger.ts     # Spec OpenAPI 3.0
│   │   ├── middleware/
│   │   │   ├── auth.ts        # JWT middleware (authenticate, requireAdmin)
│   │   │   ├── validate.ts    # express-validator middleware
│   │   │   └── errorHandler.ts# Global error handler
│   │   └── utils/
│   │       ├── logger.ts      # Winston (dev coloré / prod JSON)
│   │       ├── response.ts    # ResponseHelper + pagination
│   │       └── errors.ts      # Custom errors (AppError, NotFound, etc.)
│   └── modules/
│       ├── auth/              # Register, Login, Profile
│       ├── clients/           # CRUD + import Excel + export + stats
│       ├── groups/            # CRUD + gestion membres
│       └── sms/               # TwilioService + Campaigns + Rapports
├── tests/
│   ├── helpers.ts             # Mocks Prisma/Twilio + factories
│   ├── integration.test.ts    # Tests E2E API
│   └── utils.test.ts          # Tests unitaires utilitaires
├── .github/workflows/ci.yml   # Pipeline CI/CD GitHub Actions
├── Dockerfile                 # Multi-stage build
└── docker-compose.yml         # Stack complète
```

---

## 🚀 Démarrage rapide

### Prérequis

- Node.js 20+
- Un compte [Neon](https://neon.tech) (PostgreSQL serverless gratuit)
- Un compte [Twilio](https://twilio.com) (SMS)

### 1. Installation

```bash
git clone <repo>
cd sms-bulk-backend
npm install
```

### 2. Configuration

```bash
cp .env.example .env
```

Éditer `.env` :

```env
# Base de données Neon
DATABASE_URL="postgresql://user:password@ep-xxx.neon.tech/sms_bulk?sslmode=require"

# JWT (générer une clé aléatoire)
JWT_SECRET=votre_cle_secrete_min_32_caracteres

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=votre_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

### 3. Base de données

```bash
# Générer le client Prisma
npm run prisma:generate

# Créer les tables
npm run prisma:migrate

# Insérer les données de démo
npm run prisma:seed
```

### 4. Lancer le serveur

```bash
# Développement (hot-reload)
npm run dev

# Production
npm run build && npm start
```

### 5. Documentation API

Ouvrir → **http://localhost:3000/api-docs**

---

## 🔐 Authentification

Toutes les routes (sauf `/auth`) nécessitent un token JWT.

### Obtenir un token

```bash
# 1. S'inscrire
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@example.com","password":"motdepasse123"}'

# 2. Se connecter
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"motdepasse123"}'
# → Récupérer le token dans data.token
```

### Utiliser le token

```bash
curl -H "Authorization: Bearer VOTRE_TOKEN" http://localhost:3000/api/v1/clients
```

---

## 📋 Endpoints API

### 🔑 Auth — `/api/v1/auth`

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/register` | Créer un compte |
| POST | `/login` | Se connecter → JWT |
| GET | `/profile` | Mon profil 🔒 |

### 👥 Clients — `/api/v1/clients` 🔒

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/` | Liste paginée (filtres: search, groupId, tags, isActive) |
| POST | `/` | Ajouter un client |
| GET | `/stats` | Statistiques (total, actifs, par groupe) |
| GET | `/export` | Exporter vers Excel (.xlsx) |
| POST | `/import` | Import groupé via fichier Excel |
| GET | `/:id` | Détail client |
| PUT | `/:id` | Modifier un client |
| DELETE | `/:id` | Supprimer un client |
| POST | `/:id/groups/:groupId` | Ajouter au groupe |
| DELETE | `/:id/groups/:groupId` | Retirer du groupe |

### 🏷️ Groupes — `/api/v1/groups` 🔒

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/` | Liste des groupes |
| POST | `/` | Créer un groupe |
| GET | `/:id` | Détail groupe |
| PUT | `/:id` | Modifier |
| DELETE | `/:id` | Supprimer |
| GET | `/:id/clients` | Clients du groupe (paginé) |

### 📨 SMS — `/api/v1/sms` 🔒

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/send` | SMS unique vers un numéro |
| POST | `/campaigns` | Créer & envoyer une campagne groupée |
| GET | `/campaigns` | Mes campagnes (filtre par status) |
| GET | `/stats` | Statistiques campagnes |
| GET | `/campaigns/:id` | Détail campagne |
| PATCH | `/campaigns/:id/cancel` | Annuler (si PENDING) |
| GET | `/campaigns/:id/report` | Rapport de livraison détaillé |

---

## 📤 Import Excel — Format attendu

Le fichier `.xlsx` doit contenir ces colonnes (noms flexibles) :

| Colonne | Variantes acceptées | Obligatoire |
|---------|---------------------|-------------|
| Prénom | `firstName`, `FirstName`, `first_name`, `Prénom` | ✅ |
| Nom | `lastName`, `LastName`, `last_name`, `Nom` | — |
| Téléphone | `phone`, `Phone`, `telephone`, `Telephone` | ✅ |
| Email | `email`, `Email` | — |

Si un numéro de téléphone existe déjà → **mise à jour** (upsert, pas d'erreur).

---

## 📨 Envoyer une campagne SMS

```bash
# Envoyer à tous les clients actifs
curl -X POST http://localhost:3000/api/v1/sms/campaigns \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "🎉 Promo exclusive: -20% ce weekend avec le code PROMO20",
    "campaignName": "Promo Weekend",
    "sendToAll": true
  }'

# Envoyer à un groupe spécifique
curl -X POST http://localhost:3000/api/v1/sms/campaigns \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Cher client VIP, votre invitation exclusive vous attend.",
    "groupId": "uuid-du-groupe-vip"
  }'

# Envoyer à des clients ciblés
curl -X POST http://localhost:3000/api/v1/sms/campaigns \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Rappel: votre rendez-vous est demain à 10h.",
    "clientIds": ["uuid-client-1", "uuid-client-2"]
  }'

# Planifier (scheduled)
curl -X POST http://localhost:3000/api/v1/sms/campaigns \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Bonne année! Tous nos vœux pour 2025.",
    "sendToAll": true,
    "scheduledAt": "2025-01-01T00:00:00Z"
  }'
```

---

## 🧪 Tests

```bash
# Tous les tests
npm test

# Avec couverture
npm test -- --coverage

# Mode watch
npm run test:watch

# Un fichier spécifique
npm test -- auth.service.test.ts
```

### Résultats attendus

```
 PASS  src/modules/auth/auth.service.test.ts
 PASS  src/modules/clients/client.service.test.ts
 PASS  src/modules/groups/group.service.test.ts
 PASS  src/modules/sms/sms.service.test.ts
 PASS  tests/integration.test.ts
 PASS  tests/utils.test.ts

Coverage: ~80% statements
```

---

## 🐳 Docker

```bash
# Build et démarrage complet (API + DB locale + Swagger UI)
docker-compose up -d

# Développement avec hot-reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Logs
docker-compose logs -f api

# Appliquer migrations en conteneur
docker-compose exec api npx prisma migrate deploy
```

---

## 🔄 CI/CD GitHub Actions

Le pipeline `.github/workflows/ci.yml` comprend 4 jobs :

1. **Lint** — vérification TypeScript + ESLint
2. **Test** — tests unitaires + intégration sur PostgreSQL éphémère
3. **Build** — image Docker multi-stage → GitHub Container Registry
4. **Deploy** — déploiement SSH sur le serveur de production (branche `main` uniquement)

### Secrets GitHub requis

```
JWT_SECRET          → clé JWT production
DEPLOY_HOST         → IP/domaine serveur
DEPLOY_USER         → user SSH
DEPLOY_SSH_KEY      → clé privée SSH
```

---

## 📊 Modèle de données

```
User ─────────────── SmsCampaign ──── SmsLog
                           │               │
Group ──┐                  │               │
        │              (groupId)       (clientId)
ClientGroup ─── Client ────────────────────┘
```

---

## ⚙️ Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `NODE_ENV` | Environnement | `development` |
| `PORT` | Port HTTP | `3000` |
| `DATABASE_URL` | URL Neon PostgreSQL | — |
| `JWT_SECRET` | Clé JWT (min 32 chars) | — |
| `JWT_EXPIRES_IN` | Durée token | `7d` |
| `TWILIO_ACCOUNT_SID` | Twilio SID | — |
| `TWILIO_AUTH_TOKEN` | Twilio token | — |
| `TWILIO_PHONE_NUMBER` | Numéro expéditeur | — |
| `SMS_BATCH_SIZE` | Concurrence SMS | `10` |
| `SMS_BATCH_DELAY_MS` | Délai entre batches | `1000` |
| `RATE_LIMIT_MAX` | Requêtes/15 min | `100` |
| `CORS_ORIGIN` | Origines CORS | `http://localhost:5173` |

---

## 🛡️ Sécurité

- **Helmet** — headers HTTP sécurisés
- **CORS** — origines configurables
- **Rate limiting** — 100 req/15 min par IP
- **JWT** — tokens signés avec expiration
- **bcrypt** — hachage mots de passe (rounds: 12)
- **Validation** — express-validator sur tous les inputs
- **Prisma** — requêtes paramétrées (protection SQL injection)

---

## 📝 Comptes de démo (après seed)

| Rôle | Email | Mot de passe |
|------|-------|-------------|
| Admin | `admin@smsbulk.app` | `admin1234` |
| User | `demo@smsbulk.app` | `demo1234` |
