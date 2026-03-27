const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const cors = require('cors'); // Ajoutez le middleware CORS
const path = require('path');
const sharp = require('sharp'); // Ajout de Sharp pour le traitement d'images
const fs = require('fs');
const cookieParser = require('cookie-parser'); // Ajout du cookie-parser

// Chargez les variables d'environnement
dotenv.config({ path: path.join(__dirname, '.env') });

// Vérifiez que les variables d'environnement sont chargées
if (!process.env.MONGO_URI || !process.env.PORT) {
    console.error("Erreur : Les variables d'environnement MONGO_URI ou PORT ne sont pas définies.");
    process.exit(1); // Arrêtez l'exécution si les variables sont manquantes
}

console.log('Mongo URI:', process.env.MONGO_URI);
console.log('Port:', process.env.PORT);

const app = express();

// Middleware pour les logs
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url} (Origine: ${req.get('origin') || 'Inconnue'}, Referer: ${req.get('referer') || 'Inconnu'})`);
    next();
});

// Middleware CORS pour autoriser les requêtes depuis le frontend
app.use(cors({
    origin: '*', // Autoriser toutes les origines
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware pour analyser les données JSON
app.use(bodyParser.json());

// Middleware pour parser les cookies
app.use(cookieParser());

// Chemin absolu vers le dossier public
const publicPath = path.join(__dirname, '../public');
console.log('Chemin du dossier public:', publicPath);

// Servir les fichiers statiques du dossier public
app.use(express.static(publicPath));

// Servir les images de profil depuis le dossier uploads
app.use('/uploads/profile_pics', express.static(path.join(__dirname, 'uploads/profile_pics')));

// Middleware pour optimiser les images à la volée
app.get('/images/:imageName', async (req, res, next) => {
    try {
        const { imageName } = req.params;
        const width = parseInt(req.query.width) || null;
        const height = parseInt(req.query.height) || null;
        const quality = parseInt(req.query.quality) || 80;
        const format = req.query.format || 'jpeg';
        
        // Chemin de l'image originale
        const imagePath = path.join(publicPath, 'images', imageName);
        
        // Vérifier si le fichier existe
        if (!fs.existsSync(imagePath)) {
            return next(); // Passer au middleware suivant si l'image n'existe pas
        }
        
        // Créer un pipeline Sharp
        let pipeline = sharp(imagePath);
        
        // Redimensionner si nécessaire
        if (width || height) {
            pipeline = pipeline.resize(width, height, {
                fit: 'cover',
                position: 'center'
            });
        }
        
        // Convertir au format demandé et définir la qualité
        if (format === 'jpeg' || format === 'jpg') {
            pipeline = pipeline.jpeg({ quality });
        } else if (format === 'png') {
            pipeline = pipeline.png({ quality });
        } else if (format === 'webp') {
            pipeline = pipeline.webp({ quality });
        }
        
        // Envoyer l'image traitée
        res.type(`image/${format}`);
        pipeline.pipe(res);
        
    } catch (error) {
        console.error('Erreur lors du traitement de l\'image:', error);
        next(error);
    }
});

// Routes API
const voeuxRoutes = require('./routes/voeux');
const authRoutes = require('./routes/auth');
const niveauxRoutes = require('./routes/niveaux');
const specialitesRoutes = require('./routes/specialites');
const modulesRoutes = require('./routes/modules');
const departementsRoutes = require('./routes/departements');
const adminRoutes = require('./routes/admin'); // Nouvelles routes admin
const profileRoutes = require('./routes/profile'); // Routes de profil utilisateur

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes); // Montage des routes de profil

// Route spéciale pour les années académiques (en dehors des routes protégées)
app.get('/api/voeux/data/annees', async (req, res) => {
    try {
        console.log('Route /api/voeux/data/annees appelée');
        const Voeu = require('./models/Voeu');
        // Si la méthode getAnneesDisponibles existe, l'utiliser
        if (typeof Voeu.getAnneesDisponibles === 'function') {
            const annees = await Voeu.getAnneesDisponibles();
            console.log('Années récupérées:', annees);
            return res.json(annees || []);
        }
        
        // Sinon, fallback sur une requête directe
        const annees = await Voeu.distinct('annee');
        console.log('Années récupérées (fallback):', annees);
        return res.json(annees || []);
    } catch (error) {
        console.error('Erreur lors de la récupération des années:', error);
        res.status(500).json({ error: error.message });
    }
});

app.use('/api/voeux', voeuxRoutes);
app.use('/api/niveaux', niveauxRoutes);
app.use('/api/specialites', specialitesRoutes);
app.use('/api/modules', modulesRoutes);
app.use('/api/departements', departementsRoutes);
app.use('/api/admin', adminRoutes); // Nouvelles routes admin

// Route par défaut pour servir index.html ou rediriger vers login
app.get('/', async (req, res) => {
    try {
        // Vérifier si l'utilisateur est connecté via le token dans les cookies ou les headers
        const token = req.cookies?.token || req.headers?.authorization?.split(' ')[1];
        
        if (!token) {
            // Si pas de token, rediriger vers la page de connexion
            return res.sendFile(path.join(publicPath, 'login.html'));
        }

        // Vérifier le token et obtenir les informations de l'utilisateur
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Vérifier le rôle de l'utilisateur
        if (decoded.role === 'superadmin' || decoded.role === 'admin') {
            // Si admin ou superadmin, rediriger vers le panel d'administration
            return res.sendFile(path.join(publicPath, 'admin-panel.html'));
        } else {
            // Si utilisateur normal, servir la page index
            return res.sendFile(path.join(publicPath, 'index.html'));
        }
    } catch (error) {
        console.error('Erreur lors de la vérification du token:', error);
        // En cas d'erreur (token invalide), rediriger vers la page de connexion
        return res.sendFile(path.join(publicPath, 'login.html'));
    }
});

// Route pour la page de réinitialisation de mot de passe
app.get('/reset-password/:token', (req, res) => {
    res.sendFile(path.join(publicPath, 'reset-password.html'));
});

// Route pour le panel d'administration
app.get('/admin', (req, res) => {
    res.sendFile(path.join(publicPath, 'admin-panel.html'));
});

// Connexion à MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    retryWrites: true,
    w: 'majority',
    ssl: true,
    authSource: 'admin'
})
.then(() => {
    console.log('Connecté à MongoDB Atlas');
    console.log('Base de données:', mongoose.connection.db.databaseName);
})
.catch(err => {
    console.error('Erreur de connexion à MongoDB Atlas', err);
    process.exit(1); // Arrêtez l'exécution en cas d'erreur de connexion
});

// Écouter les événements de connexion MongoDB
mongoose.connection.on('error', err => {
    console.error('Erreur MongoDB:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('Déconnecté de MongoDB Atlas');
});

mongoose.connection.on('reconnected', () => {
    console.log('Reconnecté à MongoDB Atlas');
});

// Middleware de gestion d'erreurs global
app.use((err, req, res, next) => {
    console.error('Erreur détaillée:', err);
    
    // Déterminer le type d'erreur et envoyer une réponse appropriée
    if (err.name === 'ValidationError') {
        // Erreur de validation Mongoose
        const messages = Object.values(err.errors).map(error => ({
            champ: error.path,
            message: error.message
        }));
        
        return res.status(400).json({
            success: false,
            message: 'Erreur de validation des données',
            errors: messages
        });
    }
    
    if (err.name === 'CastError') {
        // Erreur de type (par exemple, ID invalide)
        return res.status(400).json({
            success: false,
            message: `Format de données invalide pour le champ '${err.path}'`,
            error: {
                champ: err.path,
                message: `La valeur '${err.value}' n'est pas valide`
            }
        });
    }
    
    if (err.code === 11000) {
        // Erreur de doublon (clé unique)
        const champ = Object.keys(err.keyPattern)[0];
        return res.status(409).json({
            success: false,
            message: `Un enregistrement avec cette valeur de '${champ}' existe déjà`,
            error: {
                champ,
                message: `Cette valeur est déjà utilisée`
            }
        });
    }
    
    // Erreurs personnalisées avec code
    if (err.code === 'EMAIL_DUPLICATE') {
        return res.status(err.status || 400).json({
            success: false,
            message: err.userMessage || 'Cet email est déjà utilisé',
            error: {
                champ: err.champ || 'email',
                code: err.code,
                message: err.message
            }
        });
    }

    if (err.code === 'INVALID_CREDENTIALS') {
        return res.status(err.status || 401).json({
            success: false,
            message: 'Email ou mot de passe incorrect',
            error: {
                code: err.code,
                message: err.message
            }
        });
    }

    if (err.code === 'MISSING_CREDENTIALS') {
        return res.status(err.status || 400).json({
            success: false,
            message: 'Veuillez fournir un email et un mot de passe',
            error: {
                code: err.code,
                message: err.message
            }
        });
    }

    if (err.code === 'USER_EXISTS') {
        return res.status(err.status || 400).json({
            success: false,
            message: err.message,
            error: {
                code: err.code,
                message: err.message
            }
        });
    }
    
    // Erreur par défaut
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Une erreur est survenue sur le serveur',
        error: process.env.NODE_ENV === 'development' ? {
            message: err.message,
            stack: err.stack
        } : 'Erreur interne du serveur'
    });
});

// Démarrer le serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
    console.log(`Servir les fichiers statiques depuis: ${publicPath}`);
});