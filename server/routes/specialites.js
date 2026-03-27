const express = require('express');
const router = express.Router();
const Specialite = require('../models/Specialite');

// Obtenir toutes les spécialités
router.get('/', async (req, res) => {
    try {
        const specialites = await Specialite.find().populate('niveau').populate('modules');
        res.json(specialites);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Obtenir une spécialité par ID
router.get('/:id', async (req, res) => {
    try {
        const specialite = await Specialite.findById(req.params.id)
            .populate('niveau')
            .populate('modules');
        if (!specialite) {
            return res.status(404).json({ message: 'Spécialité non trouvée' });
        }
        res.json(specialite);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Obtenir les spécialités par niveau
router.get('/niveau/:niveauId', async (req, res) => {
    try {
        const specialites = await Specialite.find({ niveau: req.params.niveauId })
            .populate('modules');
        res.json(specialites);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router; 