const express = require('express');
const Voeu = require('../models/Voeu');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

// IMPORTANT: Mettre les routes spécifiques qui ne nécessitent pas d'authentification EN PREMIER
// Récupérer les années académiques disponibles - ROUTE SPÉCIFIQUE sans authentification
// Utilisation de /api/voeux/data/annees pour éviter tout conflit avec /:id
router.get('/data/annees', async (req, res, next) => {
    try {
        console.log('Route /data/annees appelée');
        // Utiliser la méthode statique du modèle pour obtenir les années
        const annees = await Voeu.getAnneesDisponibles();
        console.log('Années récupérées:', annees);
        
        // S'assurer que la réponse est bien du JSON
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json(annees || []);
    } catch (error) {
        console.error('Erreur lors de la récupération des années:', error);
        next(error);
    }
});

// Middleware pour valider les données entrantes
const validerDonneesVoeux = async (req, res, next) => {
    try {
        // Vérifier si l'email est déjà utilisé (sauf si c'est une mise à jour)
        if (req.method === 'POST' || (req.method === 'PUT' && req.body.email)) {
            const doublon = await Voeu.verifierDoublon(req.body.email, req.params.id);
            if (doublon) {
                const error = new Error('Un enseignant avec cet email a déjà soumis des vœux');
                error.code = 'EMAIL_DUPLICATE';
                error.status = 400;
                error.champ = 'email';
                error.userMessage = 'Cet email est déjà utilisé par un autre enseignant. Veuillez utiliser un email différent ou contacter l\'administrateur si vous pensez qu\'il s\'agit d\'une erreur.';
                throw error;
            }
        }

        // Vérifier que les choix sont valides
        if (!req.body.choix_s1 || req.body.choix_s1.length === 0) {
            const error = new Error('Au moins un choix pour le semestre 1 est obligatoire');
            error.code = 'MISSING_S1_CHOICES';
            error.status = 400;
            error.champ = 'choix_s1';
            error.userMessage = 'Vous devez sélectionner au moins un module pour le semestre 1. Veuillez ajouter au moins un choix.';
            throw error;
        }

        if (!req.body.choix_s2 || req.body.choix_s2.length === 0) {
            const error = new Error('Au moins un choix pour le semestre 2 est obligatoire');
            error.code = 'MISSING_S2_CHOICES';
            error.status = 400;
            error.champ = 'choix_s2';
            error.userMessage = 'Vous devez sélectionner au moins un module pour le semestre 2. Veuillez ajouter au moins un choix.';
            throw error;
        }

        // Vérifier que les modules correspondent aux paliers et spécialités
        const modulesValides = [...req.body.choix_s1, ...req.body.choix_s2].every(choix => {
            return choix.palier && choix.specialite && choix.module;
        });

        if (!modulesValides) {
            const error = new Error('Les modules doivent correspondre au palier et à la spécialité');
            error.code = 'INVALID_MODULE';
            error.status = 400;
            error.champ = 'choix_s1,choix_s2';
            error.userMessage = 'Certains modules ne correspondent pas au palier ou à la spécialité sélectionnés. Veuillez vérifier vos choix et les corriger.';
            throw error;
        }

        // Vérifier que les natures des modules sont valides
        const naturesValides = [...req.body.choix_s1, ...req.body.choix_s2].every(choix => {
            if (!choix.nature || !Array.isArray(choix.nature) || choix.nature.length === 0) {
                return false;
            }
            return choix.nature.every(n => ['Cours', 'TD', 'TP'].includes(n));
        });

        if (!naturesValides) {
            const error = new Error('Les natures des modules doivent être valides');
            error.code = 'INVALID_NATURE';
            error.status = 400;
            error.champ = 'choix_s1,choix_s2';
            error.userMessage = 'Les natures des modules doivent être "Cours", "TD" ou "TP". Veuillez vérifier vos choix et les corriger.';
            throw error;
        }

        next();
    } catch (error) {
        console.error('Erreur de validation:', error);
        next(error); // Transmettre l'erreur au middleware de gestion d'erreurs
    }
};

// Middleware pour vérifier si un voeu existe
const verifierExistenceVoeu = async (req, res, next) => {
    try {
        const voeu = await Voeu.findById(req.params.id);
        if (!voeu) {
            const error = new Error('Fiche de vœux non trouvée');
            error.code = 'VOEU_NOT_FOUND';
            error.status = 404;
            throw error;
        }
        req.voeu = voeu; // Stocker le voeu pour les routes suivantes
        next();
    } catch (error) {
        console.error('Erreur lors de la vérification du voeu:', error);
        next(error); // Transmettre l'erreur au middleware de gestion d'erreurs
    }
};

// Middleware pour vérifier si l'utilisateur est autorisé à accéder à ce voeu
const verifierAutorisationVoeu = async (req, res, next) => {
    try {
        // Les administrateurs et superadmins peuvent accéder à tous les vœux
        if (req.user.role === 'admin' || req.user.role === 'superadmin') {
            return next();
        }
        
        // Les utilisateurs normaux ne peuvent accéder qu'à leurs propres vœux
        if (req.voeu.email === req.user.email) {
            return next();
        }
        
        const error = new Error('Vous n\'êtes pas autorisé à accéder à cette fiche de vœux');
        error.code = 'UNAUTHORIZED_ACCESS';
        error.status = 403;
        throw error;
    } catch (error) {
        next(error);
    }
};

// Middleware spécial pour autoriser uniquement les utilisateurs standards (non admin et non superadmin)
const authorizeStandardUsers = (req, res, next) => {
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
        const error = new Error('Les administrateurs ne peuvent pas soumettre de vœux pédagogiques');
        error.status = 403;
        error.code = 'ADMIN_CANNOT_SUBMIT';
        return next(error);
    }
    next();
};

// IMPORTANT: Mettre les routes spécifiques AVANT les routes avec paramètres (:id)

// Enregistrer une fiche de vœux
router.post('/', protect, authorizeStandardUsers, validerDonneesVoeux, async (req, res, next) => {
    try {
        console.log('Données reçues:', JSON.stringify(req.body, null, 2));
        
        // Si l'année n'est pas spécifiée, utiliser l'année en cours
        if (!req.body.annee) {
            const date = new Date();
            const annee = date.getFullYear();
            req.body.annee = `${annee}-${annee + 1}`;
        }
        
        const voeu = new Voeu(req.body);
        console.log('Voeu créé:', voeu);
        
        const savedVoeu = await voeu.save();
        console.log('Voeu sauvegardé:', savedVoeu);
        
        res.status(201).json({
            success: true,
            message: 'Fiche de vœux enregistrée avec succès',
            voeu: savedVoeu
        });
    } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
        next(error); // Transmettre l'erreur au middleware de gestion d'erreurs
    }
});

// Récupérer toutes les fiches de vœux avec pagination et filtrage
router.get('/', protect, async (req, res, next) => {
    try {
        const { page = 1, limit = 10, statut, palier, specialite, annee } = req.query;
        
        // Construire le filtre
        const filtre = {};
        
        // Si l'utilisateur n'est pas admin ou superadmin, il ne peut voir que ses propres vœux
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            filtre.email = req.user.email;
        }
        
        if (statut) filtre.statut = statut;
        if (palier) filtre['choix_s1.palier'] = palier;
        if (specialite) filtre['choix_s1.specialite'] = specialite;
        if (annee) filtre.annee = annee;
        
        // Exécuter la requête avec pagination
        const voeux = await Voeu.find(filtre)
            .sort({ date_creation: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();
        
        // Compter le nombre total de documents pour la pagination
        const count = await Voeu.countDocuments(filtre);
        
        res.json({
            success: true,
            voeux,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            totalVoeux: count
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des vœux:', error);
        next(error); // Transmettre l'erreur au middleware de gestion d'erreurs
    }
});

// Obtenir des statistiques sur les vœux
router.get('/stats/summary', protect, async (req, res, next) => {
    try {
        const { annee } = req.query;
        
        // Construire le filtre
        const filtre = {};
        
        // Si l'utilisateur n'est pas admin ou superadmin, il ne peut voir que ses propres statistiques
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            filtre.email = req.user.email;
        }
        
        if (annee) filtre.annee = annee;
        
        const totalVoeux = await Voeu.countDocuments(filtre);
        const voeuxApprouves = await Voeu.countDocuments({ ...filtre, statut: 'approuve' });
        const voeuxRefuses = await Voeu.countDocuments({ ...filtre, statut: 'refuse' });
        const voeuxEnAttente = await Voeu.countDocuments({ ...filtre, statut: 'en_attente' });
        
        // Compter les choix par palier
        const voeux = await Voeu.find(filtre);
        const choixParPalier = {};
        
        voeux.forEach(voeu => {
            [...voeu.choix_s1, ...voeu.choix_s2].forEach(choix => {
                if (!choixParPalier[choix.palier]) {
                    choixParPalier[choix.palier] = 0;
                }
                choixParPalier[choix.palier]++;
            });
        });
        
        res.json({
            success: true,
            total: totalVoeux,
            approuves: voeuxApprouves,
            refuses: voeuxRefuses,
            enAttente: voeuxEnAttente,
            choixParPalier
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques:', error);
        next(error); // Transmettre l'erreur au middleware de gestion d'erreurs
    }
});

// Récupérer une fiche de vœux par ID
router.get('/:id', protect, async (req, res, next) => {
    try {
        console.log('Récupération du vœu avec ID:', req.params.id);
        
        const voeu = await Voeu.findById(req.params.id)
            .populate('choix_s1.module', 'nom')
            .populate('choix_s1.specialite', 'nom')
            .populate('choix_s1.palier', 'nom')
            .populate('choix_s2.module', 'nom')
            .populate('choix_s2.specialite', 'nom')
            .populate('choix_s2.palier', 'nom');
        
        if (!voeu) {
            const error = new Error('Vœu non trouvé');
            error.status = 404;
            error.code = 'VOEU_NOT_FOUND';
            throw error;
        }
        
        // Vérification d'accès (uniquement admin/superadmin ou propriétaire du vœu)
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin' && req.user.email !== voeu.email) {
            const error = new Error('Vous n\'êtes pas autorisé à accéder à ce vœu');
            error.status = 403;
            error.code = 'UNAUTHORIZED_ACCESS';
            throw error;
        }
        
        console.log('Vœu récupéré avec succès');
        
        res.json({
            success: true,
            voeu
        });
    } catch (error) {
        console.error('Erreur lors de la récupération du voeu:', error);
        next(error); // Transmettre l'erreur au middleware de gestion d'erreurs
    }
});

// Mettre à jour complètement une fiche de vœux
router.put('/:id', protect, verifierExistenceVoeu, verifierAutorisationVoeu, validerDonneesVoeux, async (req, res, next) => {
    try {
        // Mettre à jour tous les champs
        const updatedVoeu = await Voeu.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        res.json({
            success: true,
            message: 'Fiche de vœux mise à jour avec succès',
            voeu: updatedVoeu
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du voeu:', error);
        next(error); // Transmettre l'erreur au middleware de gestion d'erreurs
    }
});

// Mettre à jour partiellement une fiche de vœux
router.patch('/:id', protect, verifierExistenceVoeu, verifierAutorisationVoeu, async (req, res, next) => {
    try {
        // Vérifier si c'est une mise à jour de statut
        if (req.body.statut) {
            if (!['en_attente', 'approuve', 'refuse'].includes(req.body.statut)) {
                const error = new Error('Statut invalide');
                error.code = 'INVALID_STATUS';
                error.status = 400;
                error.champ = 'statut';
                throw error;
            }
            
            // Seuls les administrateurs et superadmins peuvent changer le statut
            if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
                const error = new Error('Vous n\'êtes pas autorisé à changer le statut');
                error.code = 'UNAUTHORIZED_STATUS_CHANGE';
                error.status = 403;
                throw error;
            }
        }
        
        // Mettre à jour les champs fournis
        const updatedVoeu = await Voeu.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );
        
        res.json({
            success: true,
            message: 'Fiche de vœux mise à jour avec succès',
            voeu: updatedVoeu
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du voeu:', error);
        next(error); // Transmettre l'erreur au middleware de gestion d'erreurs
    }
});

// Mettre à jour le statut d'une fiche de vœux
router.patch('/:id/statut', protect, authorize('admin', 'superadmin'), verifierExistenceVoeu, async (req, res, next) => {
    try {
        const { statut } = req.body;
        
        if (!['en_attente', 'approuve', 'refuse'].includes(statut)) {
            const error = new Error('Statut invalide');
            error.code = 'INVALID_STATUS';
            error.status = 400;
            error.champ = 'statut';
            throw error;
        }
        
        const voeu = await Voeu.findByIdAndUpdate(
            req.params.id,
            { statut },
            { new: true, runValidators: true }
        );
        
        res.json({
            success: true,
            message: 'Statut mis à jour avec succès',
            voeu
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du statut:', error);
        next(error); // Transmettre l'erreur au middleware de gestion d'erreurs
    }
});

// Supprimer une fiche de vœux
router.delete('/:id', protect, authorize('admin', 'superadmin'), verifierExistenceVoeu, async (req, res, next) => {
    try {
        await Voeu.findByIdAndDelete(req.params.id);
        
        res.json({ 
            success: true,
            message: 'Fiche de vœux supprimée avec succès',
            id: req.params.id
        });
    } catch (error) {
        console.error('Erreur lors de la suppression du voeu:', error);
        next(error); // Transmettre l'erreur au middleware de gestion d'erreurs
    }
});

module.exports = router;