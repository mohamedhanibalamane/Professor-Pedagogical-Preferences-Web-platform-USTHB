const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const Voeu = require('../models/Voeu');
const Module = require('../models/Module');
const Specialite = require('../models/Specialite');
const User = require('../models/User');
const nodemailer = require('nodemailer');
const router = express.Router();

// Middleware pour protéger toutes les routes admin
router.use(protect);
router.use(authorize('admin', 'superadmin'));

// Stats pour le tableau de bord
router.get('/stats', async (req, res, next) => {
    try {
        // Récupérer les statistiques de base
        const nbEnseignants = await Voeu.countDocuments();
        const nbModules = await Module.countDocuments();
        const nbVoeux = await Voeu.countDocuments();
        
        // Récupérer les statistiques par module
        const moduleStats = await Voeu.aggregate([
            { $unwind: '$choix_s1' },
            { 
                $lookup: {
                    from: 'modules',
                    localField: 'choix_s1.module',
                    foreignField: '_id',
                    as: 'moduleInfo'
                }
            },
            { $unwind: '$moduleInfo' },
            {
                $group: {
                    _id: '$choix_s1.module',
                    module: { $first: '$moduleInfo.nom' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);
        
        // Récupérer les statistiques par grade
        const gradeStats = await Voeu.aggregate([
            {
                $group: {
                    _id: '$grade',
                    grade: { $first: '$grade' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);
        
        res.json({
            success: true,
            nbEnseignants,
            nbModules,
            nbVoeux,
            moduleStats,
            gradeStats
        });
    } catch (error) {
        next(error);
    }
});

// Liste des modules avec nombre d'enseignants
router.get('/modules', async (req, res, next) => {
    try {
        const modules = await Module.find()
            .populate('specialite', 'nom');
            
        // Enrichir les données avec le nombre d'enseignants
        const modulesAvecStats = await Promise.all(modules.map(async (module) => {
            const nbEnseignantsS1 = await Voeu.countDocuments({
                'choix_s1.module': module._id
            });
            
            const nbEnseignantsS2 = await Voeu.countDocuments({
                'choix_s2.module': module._id
            });
            
            return {
                _id: module._id,
                nom: module.nom,
                specialite: module.specialite,
                semestre: module.semestre,
                nature: module.nature,
                nbEnseignants: nbEnseignantsS1 + nbEnseignantsS2
            };
        }));
        
        res.json(modulesAvecStats);
    } catch (error) {
        next(error);
    }
});

// Récupérer les enseignants pour un module spécifique
router.get('/modules/:moduleId/enseignants', async (req, res, next) => {
    try {
        const { moduleId } = req.params;
        
        // Rechercher tous les voeux qui contiennent ce module
        const voeux = await Voeu.find({
            $or: [
                { 'choix_s1.module': moduleId },
                { 'choix_s2.module': moduleId }
            ]
        });
        
        // Traiter les données pour inclure les informations de nature
        const enseignants = voeux.map(voeu => {
            // Chercher ce module dans les choix du S1 et S2
            const moduleInS1 = voeu.choix_s1.find(choix => 
                choix.module && choix.module.toString() === moduleId
            );
            
            const moduleInS2 = voeu.choix_s2.find(choix => 
                choix.module && choix.module.toString() === moduleId
            );
            
            // Obtenir la nature depuis le choix qui contient ce module
            const nature = moduleInS1 ? moduleInS1.nature : 
                           moduleInS2 ? moduleInS2.nature : [];
            
            return {
                _id: voeu._id,
                nom: voeu.nom,
                email: voeu.email,
                telephone: voeu.telephone,
                grade: voeu.grade, 
                bureau: voeu.bureau,
                statut: voeu.statut,
                nature: nature // Inclure la nature spécifique à ce module
            };
        });
        
        res.json(enseignants);
    } catch (error) {
        next(error);
    }
});

// Liste des enseignants (depuis les vœux)
router.get('/enseignants', async (req, res, next) => {
    try {
        const enseignants = await Voeu.find()
            .select('nom email telephone grade bureau')
            .sort('nom');
        
        res.json(enseignants);
    } catch (error) {
        next(error);
    }
});

// Liste des vœux pour l'admin
router.get('/voeux', async (req, res, next) => {
    try {
        const voeux = await Voeu.find()
            .populate({
                path: 'choix_s1.module',
                select: 'nom'
            })
            .populate({
                path: 'choix_s2.module',
                select: 'nom'
            })
            .sort('-date_creation');
        
        res.json(voeux);
    } catch (error) {
        next(error);
    }
});

// Mettre à jour le statut d'un vœu
router.put('/voeux/:id/status', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { statut } = req.body;
        
        // Vérifier que le statut est valide
        if (!['en_attente', 'approuve', 'refuse'].includes(statut)) {
            return res.status(400).json({
                success: false,
                message: 'Statut invalide'
            });
        }
        
        const voeu = await Voeu.findByIdAndUpdate(
            id,
            { statut },
            { new: true, runValidators: true }
        );
        
        if (!voeu) {
            return res.status(404).json({
                success: false,
                message: 'Vœu non trouvé'
            });
        }
        
        res.json({
            success: true,
            data: voeu
        });
    } catch (error) {
        next(error);
    }
});

// Générer l'organigramme
router.post('/organigramme', async (req, res, next) => {
    try {
        const { annee, specialite } = req.body;
        
        if (!annee) {
            return res.status(400).json({
                success: false,
                message: 'Année académique requise'
            });
        }
        
        console.log(`Génération de l'organigramme pour l'année ${annee}${specialite ? ' et la spécialité ' + specialite : ''}`);
        
        // Construire la requête de filtrage - Inclure tous les vœux, pas uniquement approuvés
        const filter = { annee };
        
        // Ajouter le filtre de spécialité si fourni
        let specialiteFilter = {};
        if (specialite) {
            specialiteFilter = { 
                $or: [
                    { 'choix_s1.specialite': specialite },
                    { 'choix_s2.specialite': specialite }
                ]
            };
        }
        
        // Récupérer tous les vœux, pas uniquement ceux approuvés
        const voeux = await Voeu.find({ ...filter, ...specialiteFilter })
            .populate('choix_s1.module', 'nom')
            .populate('choix_s2.module', 'nom')
            .populate('choix_s1.specialite', 'nom')
            .populate('choix_s2.specialite', 'nom');
        
        console.log(`Nombre de vœux trouvés: ${voeux.length}`);
        
        // Vérifier si des vœux ont été trouvés
        if (voeux.length === 0) {
            return res.json({
                success: true,
                message: 'Aucun vœu trouvé pour cette année académique',
                departement: 'Non spécifié',
                modules: []
            });
        }
        
        // Organiser les données par module
        const moduleMap = new Map();
        let moduleCount = 0;
        
        voeux.forEach(voeu => {
            // Vérifier que les tableaux de choix existent
            const choixS1 = Array.isArray(voeu.choix_s1) ? voeu.choix_s1 : [];
            const choixS2 = Array.isArray(voeu.choix_s2) ? voeu.choix_s2 : [];
            
            // Traiter les choix du semestre 1
            choixS1.forEach(choix => {
                if (!choix.module || !choix.specialite) {
                    console.warn('Choix S1 invalide détecté, module ou spécialité manquant');
                    return;
                }
                
                moduleCount++;
                const moduleId = choix.module._id.toString();
                const moduleName = choix.module.nom;
                const specialiteName = choix.specialite.nom;
                
                if (!moduleMap.has(moduleId)) {
                    moduleMap.set(moduleId, {
                        _id: moduleId,
                        nom: moduleName,
                        specialite: specialiteName,
                        enseignants: [],
                        statuts: []
                    });
                }
                
                if (!moduleMap.get(moduleId).enseignants.includes(voeu.nom)) {
                    moduleMap.get(moduleId).enseignants.push(voeu.nom);
                    moduleMap.get(moduleId).statuts.push(voeu.statut);
                }
            });
            
            // Traiter les choix du semestre 2
            choixS2.forEach(choix => {
                if (!choix.module || !choix.specialite) {
                    console.warn('Choix S2 invalide détecté, module ou spécialité manquant');
                    return;
                }
                
                moduleCount++;
                const moduleId = choix.module._id.toString();
                const moduleName = choix.module.nom;
                const specialiteName = choix.specialite.nom;
                
                if (!moduleMap.has(moduleId)) {
                    moduleMap.set(moduleId, {
                        _id: moduleId,
                        nom: moduleName,
                        specialite: specialiteName,
                        enseignants: [],
                        statuts: []
                    });
                }
                
                if (!moduleMap.get(moduleId).enseignants.includes(voeu.nom)) {
                    moduleMap.get(moduleId).enseignants.push(voeu.nom);
                    moduleMap.get(moduleId).statuts.push(voeu.statut);
                }
            });
        });
        
        console.log(`Nombre total de modules traités: ${moduleCount}`);
        console.log(`Nombre de modules uniques: ${moduleMap.size}`);
        
        // Convertir la Map en tableau
        const modules = Array.from(moduleMap.values());
        
        // Récupérer le nom du département (prendre le premier voeu comme référence)
        let departement = 'Département Informatique';
        if (voeux.length > 0 && voeux[0].departement && voeux[0].departement.nom) {
            departement = voeux[0].departement.nom;
        }
        
        console.log(`Département identifié: ${departement}`);
        console.log(`Envoi de ${modules.length} modules pour l'organigramme`);
        
        res.json({
            success: true,
            departement,
            modules
        });
    } catch (error) {
        console.error('Erreur lors de la génération de l\'organigramme:', error);
        next(error);
    }
});

// Liste des utilisateurs
router.get('/users', async (req, res, next) => {
    try {
        const { role } = req.query;
        const query = role ? { role } : {};
        
        const users = await User.find(query).select('-password');
        
        res.json(users);
    } catch (error) {
        next(error);
    }
});

// Promouvoir un utilisateur au rôle d'admin
router.put('/users/:id/promote', async (req, res, next) => {
    try {
        // Vérifier si l'utilisateur est superadmin
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé. Seul le superadmin peut promouvoir des utilisateurs'
            });
        }
        
        const { id } = req.params;
        
        // Trouver l'utilisateur à promouvoir
        const user = await User.findById(id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }
        
        // Vérifier si l'utilisateur est déjà admin
        if (user.role === 'admin') {
            return res.status(400).json({
                success: false,
                message: 'Cet utilisateur est déjà administrateur'
            });
        }
        
        // Promouvoir l'utilisateur
        user.role = 'admin';
        user.promotedBy = req.user._id;
        await user.save();
        
        res.json({
            success: true,
            message: 'Utilisateur promu au rôle d\'administrateur',
            data: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        next(error);
    }
});

// Rétrograder un utilisateur du rôle d'admin
router.put('/users/:id/demote', async (req, res, next) => {
    try {
        // Vérifier si l'utilisateur est superadmin
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé. Seul le superadmin peut rétrograder des administrateurs'
            });
        }
        
        const { id } = req.params;
        
        // Trouver l'utilisateur à rétrograder
        const user = await User.findById(id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }
        
        // Vérifier si l'utilisateur est bien admin
        if (user.role !== 'admin') {
            return res.status(400).json({
                success: false,
                message: 'Cet utilisateur n\'est pas administrateur'
            });
        }
        
        // Rétrograder l'utilisateur
        user.role = 'user';
        user.promotedBy = null;
        await user.save();
        
        res.json({
            success: true,
            message: 'Administrateur rétrogradé au rôle d\'utilisateur',
            data: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        next(error);
    }
});

// Route pour envoyer les identifiants par email
router.post('/send-credentials', async (req, res, next) => {
    try {
        // Récupérer les filtres éventuels
        const { filters, selectedUsers } = req.body;
        
        // Initialiser la requête
        let query = { role: 'user' };
        
        // Appliquer les filtres si nécessaire
        if (selectedUsers && selectedUsers.length > 0) {
            query._id = { $in: selectedUsers };
        }
        
        // Fonction de génération de mot de passe
        function generateRandomPassword(length = 8) {
            const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
            const numberChars = '0123456789';
            
            const allChars = uppercaseChars + lowercaseChars + numberChars;
            let password = '';
            
            // Assurer au moins un caractère de chaque type
            password += uppercaseChars.charAt(Math.floor(Math.random() * uppercaseChars.length));
            password += lowercaseChars.charAt(Math.floor(Math.random() * lowercaseChars.length));
            password += numberChars.charAt(Math.floor(Math.random() * numberChars.length));
            
            // Compléter avec des caractères aléatoires
            for (let i = 3; i < length; i++) {
                password += allChars.charAt(Math.floor(Math.random() * allChars.length));
            }
            
            // Mélanger les caractères
            return password.split('').sort(() => 0.5 - Math.random()).join('');
        }
        
        // Fonction d'envoi d'email
        async function sendCredentialsEmail(email, password) {
            try {
                // Configurer le transporteur d'email
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.EMAIL_USERNAME,
                        pass: process.env.EMAIL_PASSWORD
                    }
                });
                
                // Options de l'email
                const mailOptions = {
                    from: process.env.EMAIL_FROM || process.env.EMAIL_USERNAME,
                    to: email,
                    subject: 'Vos identifiants de connexion - Plateforme de Vœux Pédagogiques',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                            <div style="text-align: center; padding: 20px 0; background-color: #7494ec; color: white; border-radius: 5px;">
                                <h1>Plateforme de Vœux Pédagogiques</h1>
                            </div>
                            <div style="padding: 20px; line-height: 1.5;">
                                <h2>Bonjour,</h2>
                                <p>Nous vous informons que la plateforme de soumission des vœux pédagogiques est maintenant disponible.</p>
                                <p>Vous trouverez ci-dessous vos identifiants de connexion :</p>
                                <div style="background-color: #f8f8f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                    <p><strong>Email :</strong> ${email}</p>
                                    <p><strong>Mot de passe :</strong> ${password}</p>
                                </div>
                                <p>Nous vous recommandons de changer votre mot de passe après votre première connexion pour des raisons de sécurité.</p>
                                <p>Pour vous connecter, veuillez accéder à notre plateforme en cliquant sur le lien ci-dessous :</p>
                                <div style="text-align: center; margin: 25px 0;">
                                    <a href="${(process.env.SITE_URL || 'http://localhost:5000') + '/login.html'}" style="background-color: #7494ec; color: white; padding: 12px 25px; text-decoration: none; border-radius: 25px; font-weight: bold;">Accéder à la plateforme</a>
                                </div>
                                <p>Si vous avez des questions ou rencontrez des problèmes, n'hésitez pas à nous contacter.</p>
                                <p>Cordialement,</p>
                                <p><strong>L'équipe pédagogique</strong></p>
                            </div>
                        </div>
                    `
                };
                
                // Envoyer l'email
                const info = await transporter.sendMail(mailOptions);
                return info;
            } catch (error) {
                console.error(`Erreur lors de l'envoi de l'email à ${email}:`, error);
                throw error;
            }
        }
        
        // Récupérer les enseignants selon les filtres
        const teachers = await User.find(query);
        
        if (teachers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Aucun enseignant trouvé selon les critères spécifiés'
            });
        }
        
        // Statistiques pour le rapport
        let successCount = 0;
        let errorCount = 0;
        let results = [];
        
        // Traiter chaque enseignant
        for (const teacher of teachers) {
            try {
                // Générer un mot de passe aléatoire
                const randomPassword = generateRandomPassword();
                
                // Récupérer l'utilisateur et mettre à jour le mot de passe
                const user = await User.findById(teacher._id);
                if (!user) {
                    results.push({ email: teacher.email, success: false, message: 'Utilisateur non trouvé' });
                    errorCount++;
                    continue;
                }
                
                // Mettre à jour le mot de passe
                user.password = randomPassword;
                
                // Sauvegarder pour déclencher le middleware de hachage
                await user.save();
                
                // Envoyer l'email avec les identifiants
                await sendCredentialsEmail(teacher.email, randomPassword);
                
                results.push({ email: teacher.email, success: true });
                successCount++;
                
                // Petite pause pour éviter les limitations des serveurs d'email
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                results.push({ email: teacher.email, success: false, message: error.message });
                errorCount++;
            }
        }
        
        // Retourner le rapport d'envoi
        res.json({
            success: true,
            totalEmails: teachers.length,
            successCount,
            errorCount,
            results
        });
        
    } catch (error) {
        next(error);
    }
});

module.exports = router; 